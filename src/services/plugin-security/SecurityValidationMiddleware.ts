/**
 * Security Validation Middleware for Plugin Operations
 * Integrates PluginSecurityService with plugin installation/update workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { pluginSecurityService, SecurityValidationResult } from './PluginSecurityService';
import { PrismaClient } from '@prisma/client';

interface SecurityValidationRequest {
  pluginId: string;
  version: string;
  tarballUrl: string;
  publishedBy: string;
  publishedAt: Date;
  shasum?: string;
  integrity?: string;
  signature?: string;
  publicKey?: string;
}

interface SecurityValidationResponse {
  isValid: boolean;
  securityResult: SecurityValidationResult;
  recommendations: string[];
  blockers: string[];
  warnings: string[];
}

const prisma = new PrismaClient();

export class SecurityValidationMiddleware {
  
  /**
   * Validate plugin security before installation
   */
  async validatePluginForInstallation(
    request: SecurityValidationRequest
  ): Promise<SecurityValidationResponse> {
    
    try {
      // Convert request to PluginArtifact format
      const artifact = {
        name: request.pluginId,
        version: request.version,
        tarballUrl: request.tarballUrl,
        publishedBy: request.publishedBy,
        publishedAt: request.publishedAt,
        shasum: request.shasum,
        integrity: request.integrity,
        signature: request.signature,
        publicKey: request.publicKey
      };

      // Perform security validation
      const securityResult = await pluginSecurityService.validatePluginSecurity(artifact);
      
      // Store security metadata in database
      await this.storeSecurityMetadata(request.pluginId, securityResult);
      
      // Generate response with actionable recommendations
      return this.generateValidationResponse(securityResult);
      
    } catch (error) {
      console.error('Security validation failed:', error);
      
      return {
        isValid: false,
        securityResult: {
          isValid: false,
          trustScore: 0,
          riskLevel: 'critical',
          signatures: [],
          checksums: [],
          vulnerabilities: [],
          warnings: [],
          errors: [error instanceof Error ? error.message : 'Security validation failed'],
          metadata: {
            scanTimestamp: new Date(),
            scanDuration: 0,
            packageSize: 0,
            dependencies: [],
            securityPolicies: [],
            compliance: {
              passedChecks: [],
              failedChecks: ['security-validation-error'],
              exemptions: []
            }
          }
        },
        recommendations: ['Contact security team for manual review'],
        blockers: ['Security validation system error'],
        warnings: ['Plugin installation blocked due to security validation failure']
      };
    }
  }

  /**
   * Store security metadata in database
   */
  private async storeSecurityMetadata(
    pluginId: string, 
    securityResult: SecurityValidationResult
  ): Promise<void> {
    try {
      // Find or create plugin record
      const plugin = await prisma.plugin.upsert({
        where: { name: pluginId },
        update: {
          trustScore: securityResult.trustScore,
          securityRiskLevel: securityResult.riskLevel.toUpperCase() as any,
          hasSecurityIssues: securityResult.errors.length > 0 || securityResult.riskLevel === 'critical',
          lastSecurityScan: securityResult.metadata.scanTimestamp,
          securityApprovalStatus: this.determineApprovalStatus(securityResult)
        },
        create: {
          name: pluginId,
          displayName: this.formatDisplayName(pluginId),
          trustScore: securityResult.trustScore,
          securityRiskLevel: securityResult.riskLevel.toUpperCase() as any,
          hasSecurityIssues: securityResult.errors.length > 0 || securityResult.riskLevel === 'critical',
          lastSecurityScan: securityResult.metadata.scanTimestamp,
          securityApprovalStatus: this.determineApprovalStatus(securityResult)
        }
      });

      // Store detailed security metadata
      await prisma.pluginSecurityMetadata.create({
        data: {
          pluginId: plugin.id,
          hasValidSignature: securityResult.signatures.some(s => s.isValid),
          signatureAlgorithm: securityResult.signatures.find(s => s.isValid)?.algorithm,
          signaturePublicKey: securityResult.signatures.find(s => s.isValid)?.publicKey?.substring(0, 100),
          signatureTimestamp: securityResult.signatures.find(s => s.isValid)?.timestamp,
          signatureValidatedAt: securityResult.signatures.some(s => s.isValid) ? new Date() : undefined,
          
          sha256Checksum: securityResult.checksums.find(c => c.algorithm === 'sha256')?.actual,
          sha512Checksum: securityResult.checksums.find(c => c.algorithm === 'sha512')?.actual,
          integrityVerified: securityResult.checksums.some(c => c.isValid),
          checksumSource: 'registry',
          
          trustScore: securityResult.trustScore,
          trustScoreCalculatedAt: new Date(),
          trustMetrics: securityResult.metadata as any,
          riskLevel: securityResult.riskLevel.toUpperCase() as any,
          riskFactors: this.extractRiskFactors(securityResult),
          
          lastSecurityScan: securityResult.metadata.scanTimestamp,
          securityScanStatus: 'COMPLETED',
          malwareScanResult: 'clean', // Would be determined by actual malware scan
          complianceStatus: this.mapComplianceStatus(securityResult.metadata.compliance),
          
          packageSize: securityResult.metadata.packageSize,
          downloadSource: 'npm_registry', // Would be actual download source
          
          approvalRequired: !securityResult.isValid && securityResult.riskLevel !== 'low',
          exemptions: securityResult.metadata.compliance.exemptions.length > 0 ? 
            { exemptions: securityResult.metadata.compliance.exemptions } : undefined
        }
      });

      // Store security events for audit trail
      await this.createSecurityEvents(plugin.id, securityResult);

      // Store vulnerability details if any
      if (securityResult.vulnerabilities.length > 0) {
        await this.storeVulnerabilities(plugin.id, securityResult.vulnerabilities);
      }
      
    } catch (error) {
      console.error('Failed to store security metadata:', error);
      // Don't fail the entire process if metadata storage fails
    }
  }

  /**
   * Create security events for audit trail
   */
  private async createSecurityEvents(
    pluginId: string, 
    securityResult: SecurityValidationResult
  ): Promise<void> {
    const securityMetadata = await prisma.pluginSecurityMetadata.findFirst({
      where: { pluginId },
      orderBy: { createdAt: 'desc' }
    });

    if (!securityMetadata) return;

    const events = [];

    // Signature verification events
    if (securityResult.signatures.length > 0) {
      const hasValidSignature = securityResult.signatures.some(s => s.isValid);
      events.push({
        securityMetadataId: securityMetadata.id,
        eventType: 'SIGNATURE_VERIFICATION' as any,
        severity: hasValidSignature ? 'INFO' as any : 'HIGH' as any,
        title: hasValidSignature ? 'Valid signature found' : 'No valid signatures found',
        description: hasValidSignature ? 
          'Plugin has valid digital signature' : 
          'Plugin lacks valid digital signature',
        source: 'SecurityValidationMiddleware',
        pluginName: securityResult.metadata.scanTimestamp.toISOString(), // Temporary placeholder
        details: { signatures: securityResult.signatures },
        status: 'RESOLVED' as any
      });
    }

    // Vulnerability detection events
    if (securityResult.vulnerabilities.length > 0) {
      const criticalCount = securityResult.vulnerabilities.filter(v => v.severity === 'critical').length;
      const highCount = securityResult.vulnerabilities.filter(v => v.severity === 'high').length;
      
      events.push({
        securityMetadataId: securityMetadata.id,
        eventType: 'VULNERABILITY_DETECTED' as any,
        severity: criticalCount > 0 ? 'CRITICAL' as any : highCount > 0 ? 'HIGH' as any : 'MEDIUM' as any,
        title: `${securityResult.vulnerabilities.length} vulnerabilities detected`,
        description: `Found ${criticalCount} critical, ${highCount} high severity vulnerabilities`,
        source: 'SecurityValidationMiddleware',
        pluginName: securityResult.metadata.scanTimestamp.toISOString(), // Temporary placeholder
        details: { vulnerabilities: securityResult.vulnerabilities },
        status: 'OPEN' as any
      });
    }

    // Trust score events
    events.push({
      securityMetadataId: securityMetadata.id,
      eventType: 'TRUST_SCORE_CHANGED' as any,
      severity: securityResult.trustScore >= 70 ? 'INFO' as any : 
               securityResult.trustScore >= 50 ? 'LOW' as any : 'MEDIUM' as any,
      title: `Trust score calculated: ${securityResult.trustScore}`,
      description: `Plugin trust score: ${securityResult.trustScore}/100`,
      source: 'SecurityValidationMiddleware',
      pluginName: securityResult.metadata.scanTimestamp.toISOString(), // Temporary placeholder
      details: { trustScore: securityResult.trustScore, riskLevel: securityResult.riskLevel },
      status: 'RESOLVED' as any
    });

    // Create all events
    if (events.length > 0) {
      await prisma.pluginSecurityEvent.createMany({
        data: events
      });
    }
  }

  /**
   * Store vulnerability details
   */
  private async storeVulnerabilities(
    pluginId: string, 
    vulnerabilities: any[]
  ): Promise<void> {
    const vulnerabilityData = vulnerabilities.map(vuln => ({
      pluginId,
      cveId: vuln.cve,
      severity: vuln.severity.toUpperCase(),
      score: vuln.score,
      title: vuln.id,
      description: vuln.description,
      affectedVersions: ['*'], // Would be more specific in real implementation
      patchedVersions: vuln.patchAvailable && vuln.patchVersion ? [vuln.patchVersion] : [],
      status: 'OPEN' as any,
      discoveredBy: 'SecurityValidationService',
      reportedAt: new Date()
    }));

    await prisma.pluginVulnerability.createMany({
      data: vulnerabilityData
    });
  }

  /**
   * Generate validation response with actionable items
   */
  private generateValidationResponse(
    securityResult: SecurityValidationResult
  ): SecurityValidationResponse {
    const recommendations: string[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Analyze results and generate recommendations
    if (!securityResult.isValid) {
      blockers.push(...securityResult.errors);
    }

    if (securityResult.riskLevel === 'critical') {
      blockers.push('Plugin has critical security risk level');
    } else if (securityResult.riskLevel === 'high') {
      warnings.push('Plugin has high security risk level - consider alternatives');
    }

    if (securityResult.trustScore < 50) {
      warnings.push(`Low trust score (${securityResult.trustScore}/100) - review plugin maintainer`);
    }

    const criticalVulns = securityResult.vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      blockers.push(`${criticalVulns.length} critical vulnerabilities found`);
      recommendations.push('Review vulnerabilities and check for patches');
    }

    const highVulns = securityResult.vulnerabilities.filter(v => v.severity === 'high');
    if (highVulns.length > 0) {
      warnings.push(`${highVulns.length} high severity vulnerabilities found`);
      recommendations.push('Consider waiting for security patches');
    }

    if (!securityResult.signatures.some(s => s.isValid)) {
      warnings.push('No valid digital signatures found');
      recommendations.push('Verify plugin authenticity through other means');
    }

    if (!securityResult.checksums.some(c => c.isValid)) {
      warnings.push('Package integrity could not be verified');
      recommendations.push('Download from trusted source');
    }

    // Add general recommendations
    if (securityResult.isValid) {
      recommendations.push('Plugin passed security validation');
      if (securityResult.trustScore >= 70) {
        recommendations.push('Plugin has good trust score - safe to install');
      }
    } else {
      recommendations.push('Contact security team for manual review');
      recommendations.push('Consider alternative plugins');
    }

    return {
      isValid: securityResult.isValid,
      securityResult,
      recommendations,
      blockers,
      warnings
    };
  }

  /**
   * Determine approval status based on security result
   */
  private determineApprovalStatus(securityResult: SecurityValidationResult): any {
    if (securityResult.isValid && securityResult.riskLevel === 'low') {
      return 'APPROVED';
    } else if (securityResult.riskLevel === 'critical' || securityResult.errors.length > 0) {
      return 'REJECTED';
    } else {
      return 'PENDING';
    }
  }

  /**
   * Extract risk factors from security result
   */
  private extractRiskFactors(securityResult: SecurityValidationResult): string[] {
    const factors: string[] = [];
    
    if (securityResult.errors.length > 0) {
      factors.push('validation_errors');
    }
    
    if (securityResult.vulnerabilities.filter(v => v.severity === 'critical').length > 0) {
      factors.push('critical_vulnerabilities');
    }
    
    if (!securityResult.signatures.some(s => s.isValid)) {
      factors.push('no_valid_signature');
    }
    
    if (!securityResult.checksums.some(c => c.isValid)) {
      factors.push('integrity_unverified');
    }
    
    if (securityResult.trustScore < 50) {
      factors.push('low_trust_score');
    }
    
    return factors;
  }

  /**
   * Map compliance status
   */
  private mapComplianceStatus(compliance: any): any {
    if (compliance.failedChecks.length === 0) {
      return 'COMPLIANT';
    } else if (compliance.exemptions.length > 0) {
      return 'CONDITIONALLY_COMPLIANT';
    } else {
      return 'NON_COMPLIANT';
    }
  }

  /**
   * Format display name from plugin ID
   */
  private formatDisplayName(pluginId: string): string {
    return pluginId
      .replace('@backstage/plugin-', '')
      .replace('@roadiehq/backstage-plugin-', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}

// Export singleton instance
export const securityValidationMiddleware = new SecurityValidationMiddleware();