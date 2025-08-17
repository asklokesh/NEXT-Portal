/**
 * Enterprise Multi-Tenant Management System
 * Complete tenant lifecycle, data isolation, and resource management
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// Core tenant types
export interface Tenant {
  id: string;
  slug: string; // URL-safe identifier
  name: string;
  displayName: string;
  domain?: string; // Custom domain
  subdomain: string; // Generated subdomain
  status: TenantStatus;
  tier: TenantTier;
  settings: TenantSettings;
  metadata: TenantMetadata;
  limits: TenantLimits;
  features: TenantFeatures;
  customization: TenantCustomization;
  billing: TenantBilling;
  security: TenantSecurity;
  createdAt: Date;
  updatedAt: Date;
}

export enum TenantStatus {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATING = 'deactivating',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

export enum TenantTier {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

export interface TenantSettings {
  timezone: string;
  locale: string;
  dateFormat: string;
  currency: string;
  allowUserRegistration: boolean;
  requireEmailVerification: boolean;
  enableAuditLogging: boolean;
  sessionTimeoutMinutes: number;
  passwordPolicy: PasswordPolicy;
  notificationSettings: NotificationSettings;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  preventReuse: number;
  maxAge: number; // in days
}

export interface NotificationSettings {
  emailNotifications: boolean;
  webhookEndpoint?: string;
  slackWebhook?: string;
  enableSecurityAlerts: boolean;
  enableUsageAlerts: boolean;
}

export interface TenantMetadata {
  industry?: string;
  companySize?: string;
  contactEmail: string;
  contactName: string;
  phone?: string;
  address?: TenantAddress;
  tags: string[];
  externalIds: Record<string, string>;
}

export interface TenantAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface TenantLimits {
  maxUsers: number;
  maxOrganizations: number;
  maxProjects: number;
  maxPlugins: number;
  maxStorage: number; // in bytes
  maxApiCalls: number; // per month
  maxConcurrentSessions: number;
  rateLimitPerMinute: number;
}

export interface TenantFeatures {
  sso: boolean;
  advancedAuth: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  auditLogs: boolean;
  prioritySupport: boolean;
  customDomain: boolean;
  backups: boolean;
  analytics: boolean;
  multipleEnvironments: boolean;
  approvalWorkflows: boolean;
}

export interface TenantCustomization {
  theme: TenantTheme;
  logo?: string;
  favicon?: string;
  brandColors: BrandColors;
  customCss?: string;
  customDomains: string[];
  emailTemplates: Record<string, EmailTemplate>;
}

export interface TenantTheme {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
}

export interface TenantBilling {
  subscriptionId?: string;
  planId: string;
  status: BillingStatus;
  trialEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: PaymentMethod;
  billingAddress?: TenantAddress;
  taxId?: string;
  invoiceEmail?: string;
}

export enum BillingStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid'
}

export interface PaymentMethod {
  type: 'card' | 'bank_account' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface TenantSecurity {
  encryptionKey: string;
  ipWhitelist: string[];
  allowedCountries: string[];
  requireMFA: boolean;
  sessionSecurity: SessionSecurity;
  auditSettings: AuditSettings;
}

export interface SessionSecurity {
  maxSessions: number;
  idleTimeoutMinutes: number;
  absoluteTimeoutHours: number;
  requireReauth: boolean;
}

export interface AuditSettings {
  retentionDays: number;
  includeReadOperations: boolean;
  exportFormat: 'json' | 'csv' | 'both';
  webhookUrl?: string;
}

// Tenant context for request processing
export interface TenantContext {
  tenant: Tenant;
  user?: TenantUser;
  permissions: string[];
  limits: TenantLimits;
  features: TenantFeatures;
  customization: TenantCustomization;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: TenantRole;
  permissions: string[];
  organizations: string[];
  lastLoginAt?: Date;
  isActive: boolean;
  metadata: Record<string, any>;
}

export enum TenantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
  GUEST = 'guest'
}

// Usage tracking
export interface TenantUsage {
  tenantId: string;
  period: string; // YYYY-MM
  users: UsageMetric;
  apiCalls: UsageMetric;
  storage: UsageMetric;
  sessions: UsageMetric;
  plugins: UsageMetric;
  computed: Record<string, any>;
  updatedAt: Date;
}

export interface UsageMetric {
  current: number;
  limit: number;
  peak: number;
  average: number;
  trend: number; // percentage change from previous period
}

// Main tenant manager class
export class TenantManager extends EventEmitter {
  private tenants = new Map<string, Tenant>();
  private tenantsBySlug = new Map<string, Tenant>();
  private tenantsByDomain = new Map<string, Tenant>();
  private usage = new Map<string, TenantUsage>();

  constructor() {
    super();
    this.initializeTenantManager();
  }

  private async initializeTenantManager() {
    console.log('Initializing Multi-Tenant Manager...');
    
    // Load existing tenants
    await this.loadTenants();
    
    // Initialize usage tracking
    this.initializeUsageTracking();
    
    this.emit('manager_initialized');
  }

  /**
   * Tenant Lifecycle Management
   */
  async createTenant(params: {
    name: string;
    displayName: string;
    domain?: string;
    tier: TenantTier;
    contactEmail: string;
    contactName: string;
    metadata?: Partial<TenantMetadata>;
  }): Promise<Tenant> {
    
    const slug = this.generateSlug(params.name);
    const subdomain = this.generateSubdomain(slug);
    
    // Validate uniqueness
    if (this.tenantsBySlug.has(slug)) {
      throw new Error(`Tenant slug '${slug}' already exists`);
    }
    
    if (params.domain && this.tenantsByDomain.has(params.domain)) {
      throw new Error(`Domain '${params.domain}' already in use`);
    }

    const tenant: Tenant = {
      id: crypto.randomUUID(),
      slug,
      name: params.name,
      displayName: params.displayName,
      domain: params.domain,
      subdomain,
      status: TenantStatus.PROVISIONING,
      tier: params.tier,
      settings: this.getDefaultSettings(),
      metadata: {
        contactEmail: params.contactEmail,
        contactName: params.contactName,
        tags: [],
        externalIds: {},
        ...params.metadata
      },
      limits: this.getTierLimits(params.tier),
      features: this.getTierFeatures(params.tier),
      customization: this.getDefaultCustomization(),
      billing: this.getDefaultBilling(params.tier),
      security: this.getDefaultSecurity(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store tenant
    this.tenants.set(tenant.id, tenant);
    this.tenantsBySlug.set(tenant.slug, tenant);
    if (tenant.domain) {
      this.tenantsByDomain.set(tenant.domain, tenant);
    }

    // Initialize usage tracking
    this.initializeTenantUsage(tenant.id);

    // Start provisioning process
    await this.provisionTenant(tenant);

    this.emit('tenant_created', tenant);
    return tenant;
  }

  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return null;

    const updatedTenant = {
      ...tenant,
      ...updates,
      updatedAt: new Date()
    };

    // Update indexes if slug or domain changed
    if (updates.slug && updates.slug !== tenant.slug) {
      this.tenantsBySlug.delete(tenant.slug);
      this.tenantsBySlug.set(updates.slug, updatedTenant);
    }

    if (updates.domain !== tenant.domain) {
      if (tenant.domain) this.tenantsByDomain.delete(tenant.domain);
      if (updates.domain) this.tenantsByDomain.set(updates.domain, updatedTenant);
    }

    this.tenants.set(tenantId, updatedTenant);
    this.emit('tenant_updated', updatedTenant, tenant);
    
    return updatedTenant;
  }

  async deleteTenant(tenantId: string, force = false): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;

    if (!force && tenant.status !== TenantStatus.SUSPENDED) {
      throw new Error('Tenant must be suspended before deletion');
    }

    // Mark as deleting first
    await this.updateTenant(tenantId, { status: TenantStatus.DELETED });

    // Perform cleanup
    await this.cleanupTenantData(tenant);

    // Remove from indexes
    this.tenants.delete(tenantId);
    this.tenantsBySlug.delete(tenant.slug);
    if (tenant.domain) this.tenantsByDomain.delete(tenant.domain);
    this.usage.delete(tenantId);

    this.emit('tenant_deleted', tenant);
    return true;
  }

  /**
   * Tenant Discovery and Context
   */
  getTenantById(id: string): Tenant | null {
    return this.tenants.get(id) || null;
  }

  getTenantBySlug(slug: string): Tenant | null {
    return this.tenantsBySlug.get(slug) || null;
  }

  getTenantByDomain(domain: string): Tenant | null {
    return this.tenantsByDomain.get(domain) || null;
  }

  getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  getActiveTenants(): Tenant[] {
    return Array.from(this.tenants.values()).filter(t => t.status === TenantStatus.ACTIVE);
  }

  getTenantsByTier(tier: TenantTier): Tenant[] {
    return Array.from(this.tenants.values()).filter(t => t.tier === tier);
  }

  /**
   * Usage Tracking and Limits
   */
  async recordUsage(tenantId: string, metric: string, amount: number = 1): Promise<void> {
    let usage = this.usage.get(tenantId);
    if (!usage) {
      this.initializeTenantUsage(tenantId);
      usage = this.usage.get(tenantId)!;
    }

    const period = new Date().toISOString().substring(0, 7); // YYYY-MM
    if (usage.period !== period) {
      // New period, reset counters
      usage = this.resetUsageForNewPeriod(tenantId, period);
    }

    // Update specific metric
    const metricData = (usage as any)[metric];
    if (metricData) {
      metricData.current += amount;
      metricData.peak = Math.max(metricData.peak, metricData.current);
    }

    usage.updatedAt = new Date();
    this.usage.set(tenantId, usage);

    // Check limits
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      await this.checkUsageLimits(tenant, usage);
    }

    this.emit('usage_recorded', tenantId, metric, amount);
  }

  async getTenantUsage(tenantId: string, period?: string): Promise<TenantUsage | null> {
    return this.usage.get(tenantId) || null;
  }

  async checkUsageLimits(tenant: Tenant, usage: TenantUsage): Promise<void> {
    const warnings: string[] = [];
    const violations: string[] = [];

    // Check each metric against limits
    Object.entries(usage).forEach(([metric, data]) => {
      if (typeof data === 'object' && data.current && data.limit) {
        const usagePercent = (data.current / data.limit) * 100;
        
        if (usagePercent >= 100) {
          violations.push(`${metric} limit exceeded: ${data.current}/${data.limit}`);
        } else if (usagePercent >= 80) {
          warnings.push(`${metric} usage at ${Math.round(usagePercent)}%: ${data.current}/${data.limit}`);
        }
      }
    });

    if (warnings.length > 0) {
      this.emit('usage_warning', tenant, warnings);
    }

    if (violations.length > 0) {
      this.emit('usage_violation', tenant, violations);
      
      // Suspend tenant if critical limits exceeded
      if (violations.some(v => v.includes('users') || v.includes('storage'))) {
        await this.updateTenant(tenant.id, { status: TenantStatus.SUSPENDED });
      }
    }
  }

  /**
   * Tenant Configuration and Customization
   */
  async updateTenantSettings(tenantId: string, settings: Partial<TenantSettings>): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;

    const updatedSettings = { ...tenant.settings, ...settings };
    await this.updateTenant(tenantId, { settings: updatedSettings });
    
    this.emit('settings_updated', tenant, updatedSettings);
    return true;
  }

  async updateTenantCustomization(tenantId: string, customization: Partial<TenantCustomization>): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;

    const updatedCustomization = { ...tenant.customization, ...customization };
    await this.updateTenant(tenantId, { customization: updatedCustomization });
    
    this.emit('customization_updated', tenant, updatedCustomization);
    return true;
  }

  async updateTenantFeatures(tenantId: string, features: Partial<TenantFeatures>): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;

    const updatedFeatures = { ...tenant.features, ...features };
    await this.updateTenant(tenantId, { features: updatedFeatures });
    
    this.emit('features_updated', tenant, updatedFeatures);
    return true;
  }

  /**
   * Private helper methods
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  private generateSubdomain(slug: string): string {
    return slug + '-' + crypto.randomBytes(4).toString('hex');
  }

  private getDefaultSettings(): TenantSettings {
    return {
      timezone: 'UTC',
      locale: 'en-US',
      dateFormat: 'YYYY-MM-DD',
      currency: 'USD',
      allowUserRegistration: true,
      requireEmailVerification: true,
      enableAuditLogging: true,
      sessionTimeoutMinutes: 60,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        preventReuse: 3,
        maxAge: 90
      },
      notificationSettings: {
        emailNotifications: true,
        enableSecurityAlerts: true,
        enableUsageAlerts: true
      }
    };
  }

  private getTierLimits(tier: TenantTier): TenantLimits {
    const limits = {
      [TenantTier.STARTER]: {
        maxUsers: 10,
        maxOrganizations: 1,
        maxProjects: 5,
        maxPlugins: 10,
        maxStorage: 1024 * 1024 * 1024, // 1GB
        maxApiCalls: 10000,
        maxConcurrentSessions: 5,
        rateLimitPerMinute: 100
      },
      [TenantTier.PROFESSIONAL]: {
        maxUsers: 50,
        maxOrganizations: 5,
        maxProjects: 25,
        maxPlugins: 50,
        maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
        maxApiCalls: 100000,
        maxConcurrentSessions: 25,
        rateLimitPerMinute: 500
      },
      [TenantTier.ENTERPRISE]: {
        maxUsers: 500,
        maxOrganizations: 50,
        maxProjects: 100,
        maxPlugins: 200,
        maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
        maxApiCalls: 1000000,
        maxConcurrentSessions: 100,
        rateLimitPerMinute: 2000
      },
      [TenantTier.CUSTOM]: {
        maxUsers: -1, // unlimited
        maxOrganizations: -1,
        maxProjects: -1,
        maxPlugins: -1,
        maxStorage: -1,
        maxApiCalls: -1,
        maxConcurrentSessions: -1,
        rateLimitPerMinute: -1
      }
    };

    return limits[tier];
  }

  private getTierFeatures(tier: TenantTier): TenantFeatures {
    const features = {
      [TenantTier.STARTER]: {
        sso: false,
        advancedAuth: false,
        customBranding: false,
        apiAccess: true,
        webhooks: false,
        auditLogs: false,
        prioritySupport: false,
        customDomain: false,
        backups: false,
        analytics: false,
        multipleEnvironments: false,
        approvalWorkflows: false
      },
      [TenantTier.PROFESSIONAL]: {
        sso: true,
        advancedAuth: true,
        customBranding: true,
        apiAccess: true,
        webhooks: true,
        auditLogs: true,
        prioritySupport: false,
        customDomain: false,
        backups: true,
        analytics: true,
        multipleEnvironments: false,
        approvalWorkflows: true
      },
      [TenantTier.ENTERPRISE]: {
        sso: true,
        advancedAuth: true,
        customBranding: true,
        apiAccess: true,
        webhooks: true,
        auditLogs: true,
        prioritySupport: true,
        customDomain: true,
        backups: true,
        analytics: true,
        multipleEnvironments: true,
        approvalWorkflows: true
      },
      [TenantTier.CUSTOM]: {
        sso: true,
        advancedAuth: true,
        customBranding: true,
        apiAccess: true,
        webhooks: true,
        auditLogs: true,
        prioritySupport: true,
        customDomain: true,
        backups: true,
        analytics: true,
        multipleEnvironments: true,
        approvalWorkflows: true
      }
    };

    return features[tier];
  }

  private getDefaultCustomization(): TenantCustomization {
    return {
      theme: {
        mode: 'light',
        primaryColor: '#1f2937',
        secondaryColor: '#6b7280',
        accentColor: '#3b82f6',
        backgroundColor: '#ffffff',
        surfaceColor: '#f9fafb',
        textColor: '#111827',
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      brandColors: {
        primary: '#3b82f6',
        secondary: '#6b7280',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4'
      },
      customDomains: [],
      emailTemplates: {}
    };
  }

  private getDefaultBilling(tier: TenantTier): TenantBilling {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
    
    return {
      planId: tier,
      status: BillingStatus.TRIAL,
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false
    };
  }

  private getDefaultSecurity(): TenantSecurity {
    return {
      encryptionKey: crypto.randomBytes(32).toString('hex'),
      ipWhitelist: [],
      allowedCountries: [],
      requireMFA: false,
      sessionSecurity: {
        maxSessions: 10,
        idleTimeoutMinutes: 60,
        absoluteTimeoutHours: 24,
        requireReauth: false
      },
      auditSettings: {
        retentionDays: 90,
        includeReadOperations: false,
        exportFormat: 'json'
      }
    };
  }

  private async provisionTenant(tenant: Tenant): Promise<void> {
    try {
      // Provision tenant infrastructure
      console.log(`Provisioning tenant: ${tenant.name}`);
      
      // In production:
      // 1. Create tenant-specific database schema
      // 2. Setup tenant-specific encryption keys
      // 3. Initialize default data
      // 4. Setup monitoring and alerting
      // 5. Configure backup schedules
      
      // Simulate provisioning time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.updateTenant(tenant.id, { status: TenantStatus.ACTIVE });
      
      console.log(`Tenant provisioned successfully: ${tenant.name}`);
      
    } catch (error) {
      console.error(`Tenant provisioning failed: ${tenant.name}`, error);
      await this.updateTenant(tenant.id, { status: TenantStatus.SUSPENDED });
      throw error;
    }
  }

  private async cleanupTenantData(tenant: Tenant): Promise<void> {
    console.log(`Cleaning up tenant data: ${tenant.name}`);
    
    // In production:
    // 1. Backup tenant data
    // 2. Delete tenant-specific resources
    // 3. Clean up file storage
    // 4. Remove monitoring configurations
    // 5. Cancel subscriptions
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private initializeTenantUsage(tenantId: string): void {
    const period = new Date().toISOString().substring(0, 7);
    
    const usage: TenantUsage = {
      tenantId,
      period,
      users: { current: 0, limit: 0, peak: 0, average: 0, trend: 0 },
      apiCalls: { current: 0, limit: 0, peak: 0, average: 0, trend: 0 },
      storage: { current: 0, limit: 0, peak: 0, average: 0, trend: 0 },
      sessions: { current: 0, limit: 0, peak: 0, average: 0, trend: 0 },
      plugins: { current: 0, limit: 0, peak: 0, average: 0, trend: 0 },
      computed: {},
      updatedAt: new Date()
    };

    this.usage.set(tenantId, usage);
  }

  private resetUsageForNewPeriod(tenantId: string, period: string): TenantUsage {
    const currentUsage = this.usage.get(tenantId);
    
    const newUsage: TenantUsage = {
      tenantId,
      period,
      users: { current: 0, limit: currentUsage?.users.limit || 0, peak: 0, average: 0, trend: 0 },
      apiCalls: { current: 0, limit: currentUsage?.apiCalls.limit || 0, peak: 0, average: 0, trend: 0 },
      storage: { current: currentUsage?.storage.current || 0, limit: currentUsage?.storage.limit || 0, peak: 0, average: 0, trend: 0 },
      sessions: { current: 0, limit: currentUsage?.sessions.limit || 0, peak: 0, average: 0, trend: 0 },
      plugins: { current: currentUsage?.plugins.current || 0, limit: currentUsage?.plugins.limit || 0, peak: 0, average: 0, trend: 0 },
      computed: {},
      updatedAt: new Date()
    };

    this.usage.set(tenantId, newUsage);
    return newUsage;
  }

  private async loadTenants(): Promise<void> {
    // In production, load from database
    console.log('Loading existing tenants...');
  }

  private initializeUsageTracking(): void {
    // Start periodic usage aggregation
    setInterval(() => {
      this.aggregateUsageMetrics();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async aggregateUsageMetrics(): Promise<void> {
    for (const [tenantId, usage] of this.usage.entries()) {
      // Calculate averages and trends
      // In production, this would query actual usage data
    }
  }
}

// Export singleton instance
export const tenantManager = new TenantManager();
export default tenantManager;