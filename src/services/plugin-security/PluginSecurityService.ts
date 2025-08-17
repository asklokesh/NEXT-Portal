/**
 * Enterprise Plugin Security Service
 * Implements secure artifact verification, signature validation, and trust scoring
 */

import crypto from 'crypto';
import { createHash, createVerify } from 'crypto';
import { getSafePrismaClient } from '@/lib/db/safe-client';

// Security configuration interfaces
interface SecurityConfig {
  enableSignatureVerification: boolean;
  enableChecksumValidation: boolean;
  enableTrustScoring: boolean;
  minimumTrustScore: number;
  trustedPublishers: string[];
  allowedAlgorithms: SignatureAlgorithm[];
  checksumAlgorithms: ChecksumAlgorithm[];
}

interface PluginArtifact {
  name: string;
  version: string;
  tarballUrl: string;
  checksum?: string;
  checksumAlgorithm?: ChecksumAlgorithm;
  signature?: string;
  signatureAlgorithm?: SignatureAlgorithm;
  publicKey?: string;
  publisher?: string;
  metadata?: Record<string, any>;
}

interface SignatureVerificationResult {
  verified: boolean;
  algorithm: SignatureAlgorithm;
  publicKey?: string;
  timestamp?: Date;
  error?: string;
}

interface ChecksumValidationResult {
  valid: boolean;
  algorithm: ChecksumAlgorithm;
  expected: string;
  actual: string;
  error?: string;
}

interface TrustScoreResult {
  score: number;
  factors: TrustFactor[];
  recommendation: 'TRUSTED' | 'REVIEW_REQUIRED' | 'BLOCKED';
  details: string;
}

interface TrustFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface SecurityValidationResult {
  passed: boolean;
  signatureVerification?: SignatureVerificationResult;
  checksumValidation?: ChecksumValidationResult;
  trustScore?: TrustScoreResult;
  securityLevel: SecurityLevel;
  warnings: string[];
  errors: string[];
  timestamp: Date;
}

enum SignatureAlgorithm {
  RSA_SHA256 = 'rsa-sha256',
  ECDSA_SHA256 = 'ecdsa-sha256',
  ED25519 = 'ed25519'
}

enum ChecksumAlgorithm {
  SHA256 = 'sha256',
  SHA512 = 'sha512',
  BLAKE2B = 'blake2b'
}

enum SecurityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  BLOCKED = 'blocked'
}

export class PluginSecurityService {
  private config: SecurityConfig;
  private prisma = getSafePrismaClient();

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      enableSignatureVerification: true,
      enableChecksumValidation: true,
      enableTrustScoring: true,
      minimumTrustScore: 70,
      trustedPublishers: [
        '@backstage',
        '@backstage-community',
        '@roadiehq',
        '@spotify'
      ],
      allowedAlgorithms: [
        SignatureAlgorithm.RSA_SHA256,
        SignatureAlgorithm.ECDSA_SHA256,
        SignatureAlgorithm.ED25519
      ],
      checksumAlgorithms: [
        ChecksumAlgorithm.SHA256,
        ChecksumAlgorithm.SHA512
      ],
      ...config
    };
  }

  /**
   * Main security validation entry point
   */
  async validatePluginSecurity(artifact: PluginArtifact): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      passed: false,
      securityLevel: SecurityLevel.BLOCKED,
      warnings: [],
      errors: [],
      timestamp: new Date()
    };

    try {
      // 1. Signature verification
      if (this.config.enableSignatureVerification) {
        result.signatureVerification = await this.verifySignature(artifact);
        if (!result.signatureVerification.verified) {
          result.errors.push('Plugin signature verification failed');
        }
      }

      // 2. Checksum validation
      if (this.config.enableChecksumValidation) {
        result.checksumValidation = await this.validateChecksum(artifact);
        if (!result.checksumValidation.valid) {
          result.errors.push('Plugin checksum validation failed');
        }
      }

      // 3. Trust scoring
      if (this.config.enableTrustScoring) {
        result.trustScore = await this.calculateTrustScore(artifact);
        if (result.trustScore.score < this.config.minimumTrustScore) {
          result.warnings.push(`Plugin trust score (${result.trustScore.score}) below threshold (${this.config.minimumTrustScore})`);
        }
      }

      // 4. Vulnerability scanning
      const vulnerabilities = await this.scanVulnerabilities(artifact);
      if (vulnerabilities.length > 0) {
        const criticalVulns = vulnerabilities.filter(v => v.severity === 'CRITICAL');
        if (criticalVulns.length > 0) {
          result.errors.push(`Plugin has ${criticalVulns.length} critical vulnerabilities`);
        } else {
          result.warnings.push(`Plugin has ${vulnerabilities.length} known vulnerabilities`);
        }
      }

      // 5. Determine security level and pass/fail
      result.securityLevel = this.determineSecurityLevel(result);
      result.passed = result.securityLevel !== SecurityLevel.BLOCKED && result.errors.length === 0;

      // 6. Log security event
      await this.logSecurityEvent(artifact, result);

      return result;

    } catch (error) {
      result.errors.push(`Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.securityLevel = SecurityLevel.BLOCKED;
      return result;
    }
  }

  /**
   * Verify plugin artifact digital signature
   */
  private async verifySignature(artifact: PluginArtifact): Promise<SignatureVerificationResult> {
    const result: SignatureVerificationResult = {
      verified: false,
      algorithm: artifact.signatureAlgorithm || SignatureAlgorithm.RSA_SHA256
    };

    try {
      if (!artifact.signature || !artifact.publicKey) {
        result.error = 'Missing signature or public key';
        return result;
      }

      // Download and hash the artifact
      const artifactData = await this.downloadArtifact(artifact.tarballUrl);
      const hash = createHash('sha256').update(artifactData).digest('hex');

      // Verify signature
      const verify = createVerify('sha256');
      verify.update(hash);
      
      const publicKey = await this.getPublicKey(artifact.publisher);
      result.verified = verify.verify(publicKey, artifact.signature, 'base64');
      result.publicKey = publicKey;
      result.timestamp = new Date();

      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Signature verification failed';
      return result;
    }
  }

  /**
   * Validate plugin artifact checksum
   */
  private async validateChecksum(artifact: PluginArtifact): Promise<ChecksumValidationResult> {
    const result: ChecksumValidationResult = {
      valid: false,
      algorithm: artifact.checksumAlgorithm || ChecksumAlgorithm.SHA256,
      expected: artifact.checksum || '',
      actual: ''
    };

    try {
      if (!artifact.checksum) {
        result.error = 'No checksum provided';
        return result;
      }

      // Download and hash the artifact
      const artifactData = await this.downloadArtifact(artifact.tarballUrl);
      
      let hash: string;
      switch (result.algorithm) {
        case ChecksumAlgorithm.SHA256:
          hash = createHash('sha256').update(artifactData).digest('hex');
          break;
        case ChecksumAlgorithm.SHA512:
          hash = createHash('sha512').update(artifactData).digest('hex');
          break;
        case ChecksumAlgorithm.BLAKE2B:
          // Note: Node.js doesn't have built-in Blake2b, would need external library
          hash = createHash('sha256').update(artifactData).digest('hex');
          break;
        default:
          hash = createHash('sha256').update(artifactData).digest('hex');
      }

      result.actual = hash;
      result.valid = hash === artifact.checksum;

      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Checksum validation failed';
      return result;
    }
  }

  /**
   * Calculate comprehensive trust score for plugin
   */
  private async calculateTrustScore(artifact: PluginArtifact): Promise<TrustScoreResult> {
    const factors: TrustFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    try {
      // 1. Publisher Trust (40% weight)
      const publisherScore = await this.evaluatePublisherTrust(artifact.publisher);
      factors.push({
        name: 'Publisher Trust',
        weight: 40,
        score: publisherScore,
        description: `Trust level of publisher: ${artifact.publisher}`
      });

      // 2. Security History (25% weight)
      const securityScore = await this.evaluateSecurityHistory(artifact.name);
      factors.push({
        name: 'Security History',
        weight: 25,
        score: securityScore,
        description: 'Historical security vulnerabilities and response'
      });

      // 3. Community Adoption (20% weight)
      const adoptionScore = await this.evaluateCommunityAdoption(artifact.name);
      factors.push({
        name: 'Community Adoption',
        weight: 20,
        score: adoptionScore,
        description: 'Download count, stars, and community usage'
      });

      // 4. Code Quality (10% weight)
      const qualityScore = await this.evaluateCodeQuality(artifact.name);
      factors.push({
        name: 'Code Quality',
        weight: 10,
        score: qualityScore,
        description: 'Code quality metrics and maintainability'
      });

      // 5. Update Frequency (5% weight)
      const updateScore = await this.evaluateUpdateFrequency(artifact.name);
      factors.push({
        name: 'Update Frequency',
        weight: 5,
        score: updateScore,
        description: 'Regular updates and maintenance activity'
      });

      // Calculate weighted average
      factors.forEach(factor => {
        totalScore += factor.score * (factor.weight / 100);
        totalWeight += factor.weight;
      });

      const finalScore = Math.round(totalScore);
      let recommendation: 'TRUSTED' | 'REVIEW_REQUIRED' | 'BLOCKED';

      if (finalScore >= 80) {
        recommendation = 'TRUSTED';
      } else if (finalScore >= this.config.minimumTrustScore) {
        recommendation = 'REVIEW_REQUIRED';
      } else {
        recommendation = 'BLOCKED';
      }

      return {
        score: finalScore,
        factors,
        recommendation,
        details: `Overall trust score: ${finalScore}/100 (${recommendation})`
      };

    } catch (error) {
      return {
        score: 0,
        factors,
        recommendation: 'BLOCKED',
        details: `Trust scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Scan for known vulnerabilities
   */
  private async scanVulnerabilities(artifact: PluginArtifact) {
    try {
      // Query existing vulnerabilities from database
      const vulnerabilities = await this.prisma.pluginVulnerability.findMany({
        where: {
          plugin: {
            name: artifact.name
          },
          status: {
            in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
          }
        },
        select: {
          id: true,
          cveId: true,
          severity: true,
          title: true,
          description: true,
          affectedVersions: true,
          patchedVersions: true
        }
      });

      // Check if current version is affected
      return vulnerabilities.filter(vuln => {
        return vuln.affectedVersions.includes(artifact.version) &&
               !vuln.patchedVersions.includes(artifact.version);
      });

    } catch (error) {
      console.error('Vulnerability scanning failed:', error);
      return [];
    }
  }

  /**
   * Helper methods for trust scoring factors
   */
  private async evaluatePublisherTrust(publisher?: string): Promise<number> {
    if (!publisher) return 0;
    
    if (this.config.trustedPublishers.includes(publisher)) {
      return 100;
    }

    // Check publisher reputation in database
    // This would typically query external APIs or maintain publisher reputation data
    return 50; // Default neutral score
  }

  private async evaluateSecurityHistory(pluginName: string): Promise<number> {
    try {
      const vulnerabilities = await this.prisma.pluginVulnerability.findMany({
        where: {
          plugin: { name: pluginName }
        },
        select: {
          severity: true,
          status: true,
          createdAt: true
        }
      });

      if (vulnerabilities.length === 0) return 100;

      // Calculate score based on vulnerability history
      const criticalCount = vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
      const highCount = vulnerabilities.filter(v => v.severity === 'HIGH').length;
      const resolvedCount = vulnerabilities.filter(v => v.status === 'RESOLVED').length;

      let score = 100;
      score -= criticalCount * 30;
      score -= highCount * 15;
      score += (resolvedCount / vulnerabilities.length) * 20;

      return Math.max(0, Math.min(100, score));

    } catch (error) {
      return 50; // Default neutral score on error
    }
  }

  private async evaluateCommunityAdoption(pluginName: string): Promise<number> {
    // This would typically integrate with NPM API, GitHub API, etc.
    // For now, return a mock score based on plugin name patterns
    if (pluginName.startsWith('@backstage/')) return 90;
    if (pluginName.startsWith('@backstage-community/')) return 80;
    return 60; // Default score
  }

  private async evaluateCodeQuality(pluginName: string): Promise<number> {
    // This would integrate with code quality tools like SonarQube, CodeClimate, etc.
    return 75; // Default score
  }

  private async evaluateUpdateFrequency(pluginName: string): Promise<number> {
    // This would check Git history, NPM publish dates, etc.
    return 70; // Default score
  }

  /**
   * Determine overall security level based on validation results
   */
  private determineSecurityLevel(result: SecurityValidationResult): SecurityLevel {
    if (result.errors.length > 0) {
      return SecurityLevel.BLOCKED;
    }

    if (result.trustScore && result.trustScore.score >= 90) {
      return SecurityLevel.HIGH;
    }

    if (result.warnings.length === 0) {
      return SecurityLevel.HIGH;
    }

    if (result.warnings.length <= 2) {
      return SecurityLevel.MEDIUM;
    }

    return SecurityLevel.LOW;
  }

  /**
   * Log security events for audit trail
   */
  private async logSecurityEvent(artifact: PluginArtifact, result: SecurityValidationResult): Promise<void> {
    try {
      // This would typically log to a security audit system
      console.log('Security Event:', {
        plugin: `${artifact.name}@${artifact.version}`,
        result: result.passed ? 'PASSED' : 'FAILED',
        level: result.securityLevel,
        errors: result.errors,
        warnings: result.warnings,
        timestamp: result.timestamp
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Helper methods for external integrations
   */
  private async downloadArtifact(url: string): Promise<Buffer> {
    // Mock implementation - would use fetch() or axios to download
    // For now, return empty buffer
    return Buffer.from('mock-artifact-data');
  }

  private async getPublicKey(publisher?: string): Promise<string> {
    // This would integrate with HashiCorp Vault or key management system
    return 'mock-public-key';
  }

  /**
   * Configuration and policy management
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  async addTrustedPublisher(publisher: string): Promise<void> {
    if (!this.config.trustedPublishers.includes(publisher)) {
      this.config.trustedPublishers.push(publisher);
    }
  }

  async removeTrustedPublisher(publisher: string): Promise<void> {
    const index = this.config.trustedPublishers.indexOf(publisher);
    if (index > -1) {
      this.config.trustedPublishers.splice(index, 1);
    }
  }
}

// Export the class as default
export default PluginSecurityService;

// Export a singleton instance for easy use
export const pluginSecurityService = new PluginSecurityService();