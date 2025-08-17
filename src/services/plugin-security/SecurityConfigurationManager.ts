/**
 * Security Configuration Manager
 * Manages security policies, trusted publishers, and configuration for plugin security
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

// Configuration Schemas
const SecurityPolicySchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  policyType: z.enum([
    'SIGNATURE_REQUIRED',
    'CHECKSUM_REQUIRED', 
    'TRUST_THRESHOLD',
    'VULNERABILITY_LIMITS',
    'PUBLISHER_ALLOWLIST',
    'PACKAGE_SIZE_LIMIT',
    'COMPLIANCE_REQUIRED',
    'CUSTOM'
  ]),
  rules: z.record(z.any()),
  enforcement: z.enum(['DISABLED', 'WARN', 'BLOCK', 'REQUIRE_APPROVAL']).default('WARN'),
  priority: z.number().default(100),
  appliesToPlugins: z.array(z.string()).default([]),
  appliesToCategories: z.array(z.string()).default([]),
  exemptions: z.array(z.string()).default([]),
  ownedBy: z.string(),
  approvers: z.array(z.string()).default([])
});

const TrustedPublisherSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  description: z.string().optional(),
  trustLevel: z.enum(['UNKNOWN', 'UNVERIFIED', 'BASIC', 'VERIFIED', 'TRUSTED', 'CERTIFIED']).default('VERIFIED'),
  publicKeys: z.array(z.object({
    keyId: z.string(),
    algorithm: z.string(),
    publicKey: z.string(),
    validFrom: z.date(),
    validUntil: z.date().optional(),
    isActive: z.boolean().default(true)
  })),
  allowedPackagePatterns: z.array(z.string()).default([]),
  securityPolicies: z.record(z.any()).optional(),
  autoApproval: z.boolean().default(false)
});

interface SecurityConfiguration {
  enableSignatureVerification: boolean;
  enableChecksumValidation: boolean;
  enableTrustScoring: boolean;
  enableVulnerabilityScanning: boolean;
  enableMalwareScanning: boolean;
  minimumTrustScore: number;
  maxPackageSize: number;
  allowedSignatureAlgorithms: string[];
  checksumAlgorithms: string[];
  blockedPublishers: string[];
  emergencyBypass: boolean;
  auditMode: boolean;
}

const prisma = new PrismaClient();

export class SecurityConfigurationManager {
  private defaultConfig: SecurityConfiguration = {
    enableSignatureVerification: true,
    enableChecksumValidation: true,
    enableTrustScoring: true,
    enableVulnerabilityScanning: true,
    enableMalwareScanning: false, // Optional, requires external service
    minimumTrustScore: 70,
    maxPackageSize: 100 * 1024 * 1024, // 100MB
    allowedSignatureAlgorithms: ['RSA-SHA256', 'ECDSA-SHA256', 'Ed25519'],
    checksumAlgorithms: ['sha256', 'sha512'],
    blockedPublishers: [],
    emergencyBypass: false,
    auditMode: false
  };

  /**
   * Get current security configuration
   */
  async getSecurityConfiguration(): Promise<SecurityConfiguration> {
    try {
      // In production, this would be stored in database or configuration service
      const envConfig = this.loadFromEnvironment();
      return { ...this.defaultConfig, ...envConfig };
    } catch (error) {
      console.error('Failed to load security configuration:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Create or update security policy
   */
  async createSecurityPolicy(policyData: z.infer<typeof SecurityPolicySchema>): Promise<any> {
    const validatedPolicy = SecurityPolicySchema.parse(policyData);
    
    return prisma.securityPolicy.upsert({
      where: { name: validatedPolicy.name },
      update: {
        displayName: validatedPolicy.displayName,
        description: validatedPolicy.description,
        policyType: validatedPolicy.policyType,
        rules: validatedPolicy.rules,
        enforcement: validatedPolicy.enforcement,
        priority: validatedPolicy.priority,
        appliesToPlugins: validatedPolicy.appliesToPlugins,
        appliesToCategories: validatedPolicy.appliesToCategories,
        exemptions: validatedPolicy.exemptions,
        ownedBy: validatedPolicy.ownedBy,
        approvers: validatedPolicy.approvers
      },
      create: {
        name: validatedPolicy.name,
        displayName: validatedPolicy.displayName,
        description: validatedPolicy.description,
        policyType: validatedPolicy.policyType,
        rules: validatedPolicy.rules,
        enforcement: validatedPolicy.enforcement,
        priority: validatedPolicy.priority,
        appliesToPlugins: validatedPolicy.appliesToPlugins,
        appliesToCategories: validatedPolicy.appliesToCategories,
        exemptions: validatedPolicy.exemptions,
        ownedBy: validatedPolicy.ownedBy,
        approvers: validatedPolicy.approvers
      }
    });
  }

  /**
   * Get active security policies for a plugin
   */
  async getApplicablePolicies(pluginName: string, category?: string): Promise<any[]> {
    const policies = await prisma.securityPolicy.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              { appliesToPlugins: { isEmpty: true } },
              { appliesToPlugins: { hasSome: [pluginName] } },
              { 
                appliesToPlugins: { 
                  hasSome: await this.expandPatterns([pluginName]) 
                }
              }
            ]
          },
          {
            OR: [
              { appliesToCategories: { isEmpty: true } },
              ...(category ? [{ appliesToCategories: { hasSome: [category] } }] : [])
            ]
          }
        ]
      },
      orderBy: { priority: 'desc' }
    });

    return policies.filter(policy => !policy.exemptions.includes(pluginName));
  }

  /**
   * Register trusted publisher
   */
  async registerTrustedPublisher(publisherData: z.infer<typeof TrustedPublisherSchema>): Promise<any> {
    const validatedPublisher = TrustedPublisherSchema.parse(publisherData);
    
    return prisma.trustedPublisher.upsert({
      where: { name: validatedPublisher.name },
      update: {
        displayName: validatedPublisher.displayName,
        email: validatedPublisher.email,
        website: validatedPublisher.website,
        description: validatedPublisher.description,
        trustLevel: validatedPublisher.trustLevel,
        publicKeys: validatedPublisher.publicKeys,
        allowedPackagePatterns: validatedPublisher.allowedPackagePatterns,
        securityPolicies: validatedPublisher.securityPolicies,
        autoApproval: validatedPublisher.autoApproval
      },
      create: {
        name: validatedPublisher.name,
        displayName: validatedPublisher.displayName,
        email: validatedPublisher.email,
        website: validatedPublisher.website,
        description: validatedPublisher.description,
        trustLevel: validatedPublisher.trustLevel,
        publicKeys: validatedPublisher.publicKeys,
        allowedPackagePatterns: validatedPublisher.allowedPackagePatterns,
        securityPolicies: validatedPublisher.securityPolicies,
        autoApproval: validatedPublisher.autoApproval
      }
    });
  }

  /**
   * Check if publisher is trusted
   */
  async isPublisherTrusted(publisherName: string): Promise<boolean> {
    const publisher = await prisma.trustedPublisher.findFirst({
      where: {
        name: publisherName,
        isActive: true,
        isSuspended: false
      }
    });

    return !!publisher && ['VERIFIED', 'TRUSTED', 'CERTIFIED'].includes(publisher.trustLevel);
  }

  /**
   * Get trusted publisher information
   */
  async getTrustedPublisher(publisherName: string): Promise<any | null> {
    return prisma.trustedPublisher.findFirst({
      where: {
        name: publisherName,
        isActive: true
      }
    });
  }

  /**
   * Initialize default security policies
   */
  async initializeDefaultPolicies(): Promise<void> {
    const defaultPolicies = [
      {
        name: 'signature-verification-policy',
        displayName: 'Digital Signature Verification',
        description: 'Requires valid digital signatures for all plugins',
        policyType: 'SIGNATURE_REQUIRED' as const,
        rules: {
          requireSignature: true,
          allowedAlgorithms: ['RSA-SHA256', 'ECDSA-SHA256'],
          requireTimestamp: true
        },
        enforcement: 'WARN' as const,
        priority: 100,
        ownedBy: 'system',
        approvers: ['security-team']
      },
      {
        name: 'checksum-validation-policy',
        displayName: 'Package Integrity Verification',
        description: 'Validates package checksums to ensure integrity',
        policyType: 'CHECKSUM_REQUIRED' as const,
        rules: {
          requireChecksum: true,
          algorithms: ['sha256', 'sha512'],
          allowNpmShasums: true
        },
        enforcement: 'BLOCK' as const,
        priority: 90,
        ownedBy: 'system',
        approvers: ['security-team']
      },
      {
        name: 'trust-threshold-policy',
        displayName: 'Minimum Trust Score',
        description: 'Enforces minimum trust score for plugin installations',
        policyType: 'TRUST_THRESHOLD' as const,
        rules: {
          minimumScore: 70,
          allowManualOverride: true,
          requireApprovalBelow: 50
        },
        enforcement: 'REQUIRE_APPROVAL' as const,
        priority: 80,
        ownedBy: 'system',
        approvers: ['platform-team', 'security-team']
      },
      {
        name: 'vulnerability-limits-policy',
        displayName: 'Vulnerability Limits',
        description: 'Blocks plugins with critical vulnerabilities',
        policyType: 'VULNERABILITY_LIMITS' as const,
        rules: {
          maxCritical: 0,
          maxHigh: 2,
          maxMedium: 10,
          allowPatchedVersions: true,
          gracePeridDays: 30
        },
        enforcement: 'BLOCK' as const,
        priority: 95,
        ownedBy: 'security-team',
        approvers: ['security-team']
      },
      {
        name: 'trusted-publishers-policy',
        displayName: 'Trusted Publishers',
        description: 'Allows auto-approval for trusted publishers',
        policyType: 'PUBLISHER_ALLOWLIST' as const,
        rules: {
          trustedPublishers: ['@backstage', '@roadiehq', '@spotify'],
          autoApprove: true,
          requireAdditionalChecks: false
        },
        enforcement: 'WARN' as const,
        priority: 70,
        ownedBy: 'platform-team',
        approvers: ['platform-team']
      },
      {
        name: 'package-size-limit-policy',
        displayName: 'Package Size Limits',
        description: 'Enforces maximum package size limits',
        policyType: 'PACKAGE_SIZE_LIMIT' as const,
        rules: {
          maxSizeBytes: 100 * 1024 * 1024, // 100MB
          warnSizeBytes: 50 * 1024 * 1024, // 50MB
          allowOverrideWithApproval: true
        },
        enforcement: 'BLOCK' as const,
        priority: 60,
        ownedBy: 'platform-team',
        approvers: ['platform-team', 'security-team']
      }
    ];

    for (const policy of defaultPolicies) {
      try {
        await this.createSecurityPolicy(policy);
        console.log(`Initialized security policy: ${policy.name}`);
      } catch (error) {
        console.error(`Failed to initialize policy ${policy.name}:`, error);
      }
    }
  }

  /**
   * Initialize trusted publishers
   */
  async initializeTrustedPublishers(): Promise<void> {
    const trustedPublishers = [
      {
        name: '@backstage',
        displayName: 'Backstage Core Team',
        description: 'Official Backstage plugins maintained by the core team',
        website: 'https://backstage.io',
        trustLevel: 'CERTIFIED' as const,
        publicKeys: [], // Would be populated with actual keys
        allowedPackagePatterns: ['@backstage/plugin-*', '@backstage/core-*'],
        autoApproval: true
      },
      {
        name: '@roadiehq',
        displayName: 'Roadie HQ',
        description: 'Enterprise Backstage plugins by Roadie',
        website: 'https://roadie.io',
        email: 'support@roadie.io',
        trustLevel: 'TRUSTED' as const,
        publicKeys: [], // Would be populated with actual keys
        allowedPackagePatterns: ['@roadiehq/backstage-plugin-*'],
        autoApproval: true
      },
      {
        name: '@spotify',
        displayName: 'Spotify',
        description: 'Original creators of Backstage',
        website: 'https://spotify.com',
        trustLevel: 'CERTIFIED' as const,
        publicKeys: [], // Would be populated with actual keys
        allowedPackagePatterns: ['@spotify/backstage-*'],
        autoApproval: true
      }
    ];

    for (const publisher of trustedPublishers) {
      try {
        await this.registerTrustedPublisher(publisher);
        console.log(`Registered trusted publisher: ${publisher.name}`);
      } catch (error) {
        console.error(`Failed to register publisher ${publisher.name}:`, error);
      }
    }
  }

  /**
   * Evaluate policy compliance for a plugin
   */
  async evaluatePolicyCompliance(
    pluginName: string,
    securityResult: any,
    category?: string
  ): Promise<{
    compliant: boolean;
    violations: string[];
    exemptions: string[];
    requiredApprovals: string[];
  }> {
    const policies = await this.getApplicablePolicies(pluginName, category);
    const violations: string[] = [];
    const exemptions: string[] = [];
    const requiredApprovals: string[] = [];

    for (const policy of policies) {
      const evaluation = await this.evaluatePolicy(policy, securityResult, pluginName);
      
      if (!evaluation.compliant) {
        violations.push(`Policy violation: ${policy.displayName}`);
        
        if (policy.enforcement === 'REQUIRE_APPROVAL') {
          requiredApprovals.push(...policy.approvers);
        }
      }

      if (evaluation.hasExemption) {
        exemptions.push(`Exemption applied: ${policy.displayName}`);
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      exemptions: [...new Set(exemptions)],
      requiredApprovals: [...new Set(requiredApprovals)]
    };
  }

  /**
   * Evaluate individual policy
   */
  private async evaluatePolicy(policy: any, securityResult: any, pluginName: string): Promise<{
    compliant: boolean;
    hasExemption: boolean;
    details: string;
  }> {
    // Check for exemptions first
    if (policy.exemptions.includes(pluginName)) {
      return {
        compliant: true,
        hasExemption: true,
        details: 'Plugin is exempted from this policy'
      };
    }

    switch (policy.policyType) {
      case 'SIGNATURE_REQUIRED':
        return this.evaluateSignaturePolicy(policy, securityResult);
      
      case 'CHECKSUM_REQUIRED':
        return this.evaluateChecksumPolicy(policy, securityResult);
      
      case 'TRUST_THRESHOLD':
        return this.evaluateTrustThresholdPolicy(policy, securityResult);
      
      case 'VULNERABILITY_LIMITS':
        return this.evaluateVulnerabilityPolicy(policy, securityResult);
      
      case 'PACKAGE_SIZE_LIMIT':
        return this.evaluatePackageSizePolicy(policy, securityResult);
      
      default:
        return {
          compliant: true,
          hasExemption: false,
          details: 'Policy type not implemented'
        };
    }
  }

  private evaluateSignaturePolicy(policy: any, securityResult: any) {
    const hasValidSignature = securityResult.signatures?.some((s: any) => s.isValid) || false;
    
    return {
      compliant: !policy.rules.requireSignature || hasValidSignature,
      hasExemption: false,
      details: hasValidSignature ? 'Valid signature found' : 'No valid signature found'
    };
  }

  private evaluateChecksumPolicy(policy: any, securityResult: any) {
    const hasValidChecksum = securityResult.checksums?.some((c: any) => c.isValid) || false;
    
    return {
      compliant: !policy.rules.requireChecksum || hasValidChecksum,
      hasExemption: false,
      details: hasValidChecksum ? 'Valid checksum found' : 'No valid checksum found'
    };
  }

  private evaluateTrustThresholdPolicy(policy: any, securityResult: any) {
    const trustScore = securityResult.trustScore || 0;
    const minimumScore = policy.rules.minimumScore || 70;
    
    return {
      compliant: trustScore >= minimumScore,
      hasExemption: false,
      details: `Trust score: ${trustScore}/${minimumScore} (minimum required)`
    };
  }

  private evaluateVulnerabilityPolicy(policy: any, securityResult: any) {
    const vulnerabilities = securityResult.vulnerabilities || [];
    const criticalCount = vulnerabilities.filter((v: any) => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter((v: any) => v.severity === 'high').length;
    
    const maxCritical = policy.rules.maxCritical || 0;
    const maxHigh = policy.rules.maxHigh || 5;
    
    return {
      compliant: criticalCount <= maxCritical && highCount <= maxHigh,
      hasExemption: false,
      details: `Vulnerabilities: ${criticalCount} critical (max ${maxCritical}), ${highCount} high (max ${maxHigh})`
    };
  }

  private evaluatePackageSizePolicy(policy: any, securityResult: any) {
    const packageSize = securityResult.metadata?.packageSize || 0;
    const maxSize = policy.rules.maxSizeBytes || (100 * 1024 * 1024);
    
    return {
      compliant: packageSize <= maxSize,
      hasExemption: false,
      details: `Package size: ${Math.round(packageSize / 1024 / 1024)}MB (max ${Math.round(maxSize / 1024 / 1024)}MB)`
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): Partial<SecurityConfiguration> {
    return {
      enableSignatureVerification: process.env.PLUGIN_SECURITY_ENABLE_SIGNATURE_VERIFICATION !== 'false',
      enableChecksumValidation: process.env.PLUGIN_SECURITY_ENABLE_CHECKSUM_VALIDATION !== 'false',
      enableTrustScoring: process.env.PLUGIN_SECURITY_ENABLE_TRUST_SCORING !== 'false',
      enableVulnerabilityScanning: process.env.PLUGIN_SECURITY_ENABLE_VULNERABILITY_SCANNING !== 'false',
      minimumTrustScore: parseInt(process.env.PLUGIN_SECURITY_MINIMUM_TRUST_SCORE || '70'),
      maxPackageSize: parseInt(process.env.PLUGIN_SECURITY_MAX_PACKAGE_SIZE || '104857600'), // 100MB
      emergencyBypass: process.env.PLUGIN_SECURITY_EMERGENCY_BYPASS === 'true',
      auditMode: process.env.PLUGIN_SECURITY_AUDIT_MODE === 'true'
    };
  }

  /**
   * Expand patterns to match plugin names
   */
  private async expandPatterns(patterns: string[]): Promise<string[]> {
    // Simple pattern expansion - in production would use more sophisticated matching
    const expanded: string[] = [];
    
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Would query database for matching plugins
        expanded.push(pattern);
      } else {
        expanded.push(pattern);
      }
    }
    
    return expanded;
  }
}

// Export singleton instance
export const securityConfigurationManager = new SecurityConfigurationManager();