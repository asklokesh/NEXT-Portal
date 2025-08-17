/**
 * White-Label Configuration Service
 * 
 * Multi-tenant white-labeling system with:
 * - Custom branding and theming
 * - Domain white-labeling
 * - Feature toggles per partner
 * - Partner-specific pricing
 * - Isolated multi-tenancy
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface WhiteLabelConfig {
  id: string;
  partnerId: string;
  tenantId: string;
  brandName: string;
  logoUrl: string;
  customDomain: string;
  primaryColor: string;
  secondaryColor: string;
  features: any;
  modules: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantConfig {
  branding: {
    brandName: string;
    logoUrl: string;
    faviconUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    fontFamily?: string;
    customCss?: string;
  };
  domain: {
    customDomain: string;
    sslCertificate?: string;
    dnsVerified: boolean;
  };
  features: {
    [key: string]: boolean;
  };
  modules: string[];
  plugins: string[];
  limits: {
    maxUsers: number;
    maxServices: number;
    maxStorage: number; // GB
    maxBandwidth: number; // GB/month
    maxApiCalls?: number; // per month
  };
  email: {
    fromAddress?: string;
    replyTo?: string;
    templates?: any;
  };
  legal: {
    termsUrl?: string;
    privacyUrl?: string;
    supportEmail?: string;
    supportUrl?: string;
  };
  billing: {
    enabled: boolean;
    stripeAccountId?: string;
    pricingModel?: string;
  };
}

const createWhiteLabelSchema = z.object({
  partnerId: z.string(),
  brandName: z.string().min(2).max(50),
  logoUrl: z.string().url(),
  faviconUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  fontFamily: z.string().optional(),
  customCss: z.string().optional(),
  customDomain: z.string().min(4).max(100),
  features: z.record(z.boolean()).default({}),
  modules: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  limits: z.object({
    maxUsers: z.number().min(1).default(100),
    maxServices: z.number().min(1).default(500),
    maxStorage: z.number().min(1).default(100),
    maxBandwidth: z.number().min(1).default(1000),
    maxApiCalls: z.number().min(1000).optional()
  }).default({}),
  email: z.object({
    fromAddress: z.string().email().optional(),
    replyTo: z.string().email().optional(),
    templates: z.record(z.string()).optional()
  }).optional(),
  legal: z.object({
    termsUrl: z.string().url().optional(),
    privacyUrl: z.string().url().optional(),
    supportEmail: z.string().email().optional(),
    supportUrl: z.string().url().optional()
  }).optional(),
  billing: z.object({
    enabled: z.boolean().default(false),
    stripeAccountId: z.string().optional(),
    pricingModel: z.string().optional()
  }).optional()
});

const updateWhiteLabelSchema = createWhiteLabelSchema.partial().omit({ partnerId: true });

export class WhiteLabelService extends EventEmitter {
  private defaultFeatures = {
    'service-catalog': true,
    'template-marketplace': true,
    'plugin-management': true,
    'monitoring': true,
    'cost-insights': false,
    'advanced-analytics': false,
    'api-management': false,
    'sso-enterprise': false,
    'rbac-advanced': false,
    'audit-logging': false,
    'white-labeling': false,
    'multi-tenancy': false
  };

  private defaultModules = [
    'catalog',
    'templates',
    'plugins',
    'monitoring',
    'docs'
  ];

  constructor() {
    super();
  }

  /**
   * Create white-label configuration
   */
  async createWhiteLabelConfig(
    data: z.infer<typeof createWhiteLabelSchema>
  ): Promise<WhiteLabelConfig> {
    try {
      const validatedData = createWhiteLabelSchema.parse(data);
      
      // Verify partner exists and is active
      const partner = await prisma.partner.findUnique({
        where: { id: validatedData.partnerId, status: 'ACTIVE' }
      });
      
      if (!partner) {
        throw new Error('Partner not found or not active');
      }

      // Check if partner already has white-label config
      const existingConfig = await prisma.whiteLabelConfig.findFirst({
        where: { partnerId: validatedData.partnerId }
      });
      
      if (existingConfig) {
        throw new Error('Partner already has white-label configuration');
      }

      // Generate unique tenant ID
      const tenantId = this.generateTenantId(validatedData.brandName);
      
      // Check domain availability
      await this.validateDomainAvailability(validatedData.customDomain);

      // Merge features with defaults
      const features = { ...this.defaultFeatures, ...validatedData.features };
      
      // Create white-label config
      const config = await prisma.whiteLabelConfig.create({
        data: {
          partnerId: validatedData.partnerId,
          tenantId,
          brandName: validatedData.brandName,
          logoUrl: validatedData.logoUrl,
          faviconUrl: validatedData.faviconUrl,
          primaryColor: validatedData.primaryColor,
          secondaryColor: validatedData.secondaryColor,
          accentColor: validatedData.accentColor,
          fontFamily: validatedData.fontFamily,
          customCss: validatedData.customCss,
          customDomain: validatedData.customDomain,
          features,
          modules: validatedData.modules.length > 0 ? validatedData.modules : this.defaultModules,
          plugins: validatedData.plugins,
          limits: validatedData.limits,
          emailFrom: validatedData.email?.fromAddress,
          emailReplyTo: validatedData.email?.replyTo,
          emailTemplates: validatedData.email?.templates,
          termsUrl: validatedData.legal?.termsUrl,
          privacyUrl: validatedData.legal?.privacyUrl,
          supportEmail: validatedData.legal?.supportEmail,
          supportUrl: validatedData.legal?.supportUrl,
          billingEnabled: validatedData.billing?.enabled || false,
          stripeAccountId: validatedData.billing?.stripeAccountId,
          pricingModel: validatedData.billing?.pricingModel,
          dnsVerified: false,
          isActive: true
        }
      });

      // Create tenant isolation config
      await this.createTenantIsolation(tenantId, validatedData.partnerId, validatedData.limits);

      // Setup DNS and SSL
      await this.setupDomainConfiguration(config.id, validatedData.customDomain);

      this.emit('whiteLabelConfigCreated', config);
      return config as any;
    } catch (error) {
      console.error('Error creating white-label config:', error);
      throw new Error('Failed to create white-label configuration');
    }
  }

  /**
   * Update white-label configuration
   */
  async updateWhiteLabelConfig(
    configId: string,
    data: z.infer<typeof updateWhiteLabelSchema>
  ): Promise<WhiteLabelConfig> {
    try {
      const validatedData = updateWhiteLabelSchema.parse(data);
      
      const existingConfig = await prisma.whiteLabelConfig.findUnique({
        where: { id: configId }
      });

      if (!existingConfig) {
        throw new Error('White-label configuration not found');
      }

      // Check domain change
      if (validatedData.customDomain && validatedData.customDomain !== existingConfig.customDomain) {
        await this.validateDomainAvailability(validatedData.customDomain);
        // Reset DNS verification
        validatedData.dnsVerified = false as any;
      }

      const config = await prisma.whiteLabelConfig.update({
        where: { id: configId },
        data: {
          ...validatedData,
          updatedAt: new Date()
        }
      });

      // Update tenant isolation if limits changed
      if (validatedData.limits) {
        await this.updateTenantLimits(existingConfig.tenantId, validatedData.limits);
      }

      // Update domain configuration if domain changed
      if (validatedData.customDomain) {
        await this.setupDomainConfiguration(configId, validatedData.customDomain);
      }

      this.emit('whiteLabelConfigUpdated', config);
      return config as any;
    } catch (error) {
      console.error('Error updating white-label config:', error);
      throw new Error('Failed to update white-label configuration');
    }
  }

  /**
   * Get white-label configuration by tenant ID or domain
   */
  async getWhiteLabelConfig(identifier: string): Promise<TenantConfig | null> {
    try {
      const isDomain = identifier.includes('.');
      
      const config = await prisma.whiteLabelConfig.findFirst({
        where: isDomain 
          ? { customDomain: identifier, isActive: true }
          : { tenantId: identifier, isActive: true },
        include: {
          partner: {
            select: { id: true, companyName: true, status: true }
          }
        }
      });

      if (!config || config.partner.status !== 'ACTIVE') {
        return null;
      }

      // Get tenant isolation details
      const isolation = await prisma.tenantIsolation.findUnique({
        where: { tenantId: config.tenantId }
      });

      return {
        branding: {
          brandName: config.brandName,
          logoUrl: config.logoUrl,
          faviconUrl: config.faviconUrl || undefined,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          accentColor: config.accentColor || undefined,
          fontFamily: config.fontFamily || undefined,
          customCss: config.customCss || undefined
        },
        domain: {
          customDomain: config.customDomain,
          sslCertificate: config.sslCertificate || undefined,
          dnsVerified: config.dnsVerified
        },
        features: config.features as any,
        modules: config.modules,
        plugins: config.plugins,
        limits: isolation ? {
          maxUsers: isolation.maxUsers,
          maxServices: isolation.maxServices,
          maxStorage: isolation.maxStorage,
          maxBandwidth: isolation.maxBandwidth
        } : {
          maxUsers: 100,
          maxServices: 500,
          maxStorage: 100,
          maxBandwidth: 1000
        },
        email: {
          fromAddress: config.emailFrom || undefined,
          replyTo: config.emailReplyTo || undefined,
          templates: config.emailTemplates as any
        },
        legal: {
          termsUrl: config.termsUrl || undefined,
          privacyUrl: config.privacyUrl || undefined,
          supportEmail: config.supportEmail || undefined,
          supportUrl: config.supportUrl || undefined
        },
        billing: {
          enabled: config.billingEnabled,
          stripeAccountId: config.stripeAccountId || undefined,
          pricingModel: config.pricingModel || undefined
        }
      };
    } catch (error) {
      console.error('Error fetching white-label config:', error);
      return null;
    }
  }

  /**
   * Verify DNS configuration
   */
  async verifyDnsConfiguration(configId: string): Promise<boolean> {
    try {
      const config = await prisma.whiteLabelConfig.findUnique({
        where: { id: configId }
      });

      if (!config) {
        throw new Error('Configuration not found');
      }

      // Check DNS records (simplified - would use actual DNS lookup)
      const dnsVerified = await this.checkDnsRecords(config.customDomain);

      // Update verification status
      await prisma.whiteLabelConfig.update({
        where: { id: configId },
        data: { dnsVerified }
      });

      if (dnsVerified) {
        // Setup SSL certificate
        await this.setupSslCertificate(configId, config.customDomain);
      }

      return dnsVerified;
    } catch (error) {
      console.error('Error verifying DNS:', error);
      return false;
    }
  }

  /**
   * Get all white-label configurations for a partner
   */
  async getPartnerConfigs(partnerId: string) {
    try {
      const configs = await prisma.whiteLabelConfig.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'desc' }
      });

      return configs;
    } catch (error) {
      console.error('Error fetching partner configs:', error);
      throw new Error('Failed to fetch partner configurations');
    }
  }

  /**
   * Toggle white-label configuration active status
   */
  async toggleConfigStatus(configId: string, isActive: boolean) {
    try {
      const config = await prisma.whiteLabelConfig.update({
        where: { id: configId },
        data: { isActive }
      });

      this.emit('configStatusToggled', { configId, isActive });
      return config;
    } catch (error) {
      console.error('Error toggling config status:', error);
      throw new Error('Failed to toggle configuration status');
    }
  }

  /**
   * Get tenant usage metrics
   */
  async getTenantUsage(tenantId: string) {
    try {
      // This would integrate with actual usage tracking systems
      // For now, return mock data structure
      return {
        users: {
          current: 45,
          limit: 100,
          percentage: 45
        },
        services: {
          current: 234,
          limit: 500,
          percentage: 47
        },
        storage: {
          current: 23.5, // GB
          limit: 100,
          percentage: 23.5
        },
        bandwidth: {
          current: 156.7, // GB this month
          limit: 1000,
          percentage: 15.7
        },
        apiCalls: {
          current: 45678,
          limit: 100000,
          percentage: 45.7
        }
      };
    } catch (error) {
      console.error('Error fetching tenant usage:', error);
      throw new Error('Failed to fetch tenant usage');
    }
  }

  /**
   * Generate custom CSS theme
   */
  generateCustomTheme(config: TenantConfig): string {
    const { branding } = config;
    
    return `
      :root {
        --brand-primary: ${branding.primaryColor};
        --brand-secondary: ${branding.secondaryColor};
        --brand-accent: ${branding.accentColor || branding.primaryColor};
        --brand-font-family: ${branding.fontFamily || 'Inter, sans-serif'};
      }

      .brand-logo {
        content: url('${branding.logoUrl}');
      }

      .navbar-brand {
        color: var(--brand-primary) !important;
      }

      .btn-primary {
        background-color: var(--brand-primary);
        border-color: var(--brand-primary);
      }

      .btn-primary:hover {
        background-color: color-mix(in srgb, var(--brand-primary) 85%, black);
        border-color: color-mix(in srgb, var(--brand-primary) 85%, black);
      }

      .nav-link.active {
        color: var(--brand-primary) !important;
      }

      body {
        font-family: var(--brand-font-family);
      }

      ${branding.customCss || ''}
    `;
  }

  /**
   * Validate tenant access to feature/module
   */
  async validateTenantAccess(
    tenantId: string,
    resource: string,
    action: string = 'read'
  ): Promise<boolean> {
    try {
      const config = await this.getWhiteLabelConfig(tenantId);
      if (!config) return false;

      // Check feature access
      if (config.features[resource] === false) {
        return false;
      }

      // Check module access
      if (resource.includes('/') && !config.modules.includes(resource.split('/')[0])) {
        return false;
      }

      // Check usage limits if applicable
      if (action === 'create') {
        const usage = await this.getTenantUsage(tenantId);
        
        if (resource === 'user' && usage.users.current >= usage.users.limit) {
          return false;
        }
        
        if (resource === 'service' && usage.services.current >= usage.services.limit) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating tenant access:', error);
      return false;
    }
  }

  // Private helper methods

  private generateTenantId(brandName: string): string {
    const sanitized = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const suffix = uuidv4().split('-')[0];
    return `${sanitized}-${suffix}`;
  }

  private async validateDomainAvailability(domain: string): Promise<void> {
    const existing = await prisma.whiteLabelConfig.findFirst({
      where: { customDomain: domain, isActive: true }
    });

    if (existing) {
      throw new Error('Domain already in use');
    }

    // Check if domain is reserved or blacklisted
    const reservedDomains = ['admin', 'api', 'www', 'mail', 'app', 'portal'];
    const subdomain = domain.split('.')[0];
    
    if (reservedDomains.includes(subdomain)) {
      throw new Error('Domain is reserved');
    }
  }

  private async createTenantIsolation(
    tenantId: string,
    partnerId: string,
    limits: any
  ): Promise<void> {
    await prisma.tenantIsolation.create({
      data: {
        tenantId,
        partnerId,
        maxUsers: limits.maxUsers || 100,
        maxServices: limits.maxServices || 500,
        maxStorage: limits.maxStorage || 100,
        maxBandwidth: limits.maxBandwidth || 1000
      }
    });
  }

  private async updateTenantLimits(tenantId: string, limits: any): Promise<void> {
    await prisma.tenantIsolation.update({
      where: { tenantId },
      data: {
        maxUsers: limits.maxUsers,
        maxServices: limits.maxServices,
        maxStorage: limits.maxStorage,
        maxBandwidth: limits.maxBandwidth,
        updatedAt: new Date()
      }
    });
  }

  private async setupDomainConfiguration(configId: string, domain: string): Promise<void> {
    // This would integrate with DNS providers (CloudFlare, Route53, etc.)
    // For now, just log the setup
    console.log(`Setting up domain configuration for ${domain}`);
    
    // Generate DNS instructions for partner
    const dnsInstructions = {
      type: 'CNAME',
      name: domain.split('.')[0],
      value: 'proxy.saas-idp.com',
      ttl: 300
    };

    // Store DNS instructions for partner reference
    console.log('DNS Instructions:', dnsInstructions);
  }

  private async checkDnsRecords(domain: string): Promise<boolean> {
    // This would use actual DNS resolution
    // For now, return mock verification
    return Math.random() > 0.3; // 70% success rate for demo
  }

  private async setupSslCertificate(configId: string, domain: string): Promise<void> {
    // This would integrate with Let's Encrypt or similar
    const certificateUrl = `https://certificates.saas-idp.com/${domain}.crt`;
    
    await prisma.whiteLabelConfig.update({
      where: { id: configId },
      data: { sslCertificate: certificateUrl }
    });
  }
}

export const whiteLabelService = new WhiteLabelService();