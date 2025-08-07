/**
 * Plugin Trust and Verification System
 * Implements digital signature verification, code signing, supply chain security,
 * and plugin provenance tracking with comprehensive trust management
 */

import { z } from 'zod';
import { createHash, createSign, createVerify, generateKeyPairSync } from 'crypto';
import { AuditLogger } from '../logging/audit-logger';
import { ThreatDetector } from '../detection/threat-detector';

// Plugin Verification Schema Definitions
export const PluginSignatureSchema = z.object({
  signatureId: z.string().uuid(),
  pluginId: z.string(),
  pluginVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  algorithm: z.enum(['RSA-SHA256', 'ECDSA-SHA256', 'Ed25519']),
  signature: z.string(), // Base64 encoded signature
  publicKey: z.string(), // PEM format public key
  certificateChain: z.array(z.string()).optional(), // X.509 certificate chain
  signedAt: z.date(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.any()),
  status: z.enum(['valid', 'invalid', 'expired', 'revoked']),
  verificationResults: z.array(z.object({
    verifier: z.string(),
    result: z.enum(['pass', 'fail', 'warning']),
    details: z.string(),
    timestamp: z.date()
  })).optional()
});

export const PluginProvenanceSchema = z.object({
  provenanceId: z.string().uuid(),
  pluginId: z.string(),
  pluginVersion: z.string(),
  buildInfo: z.object({
    buildId: z.string(),
    buildTime: z.date(),
    buildEnvironment: z.string(),
    builder: z.string(), // CI system or developer
    sourceCommit: z.string(),
    sourceRepository: z.string(),
    buildLogs: z.string().optional(),
    buildArtifacts: z.array(z.object({
      name: z.string(),
      hash: z.string(),
      size: z.number()
    }))
  }),
  dependencies: z.array(z.object({
    name: z.string(),
    version: z.string(),
    source: z.string(),
    integrity: z.string(), // Hash of the dependency
    license: z.string().optional(),
    vulnerabilities: z.array(z.string()).optional()
  })),
  attestations: z.array(z.object({
    type: z.enum(['slsa', 'in-toto', 'custom']),
    predicate: z.record(z.any()),
    signature: z.string(),
    signer: z.string()
  })),
  supplyChain: z.object({
    sourceVerified: z.boolean(),
    buildReproducible: z.boolean(),
    dependenciesVerified: z.boolean(),
    vulnerabilitiesScanned: z.boolean(),
    licenseCompliant: z.boolean()
  }),
  createdAt: z.date(),
  verifiedAt: z.date().optional(),
  trustScore: z.number().min(0).max(100)
});

export const TrustPolicySchema = z.object({
  policyId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  scope: z.enum(['global', 'organization', 'environment', 'plugin']),
  rules: z.array(z.object({
    ruleId: z.string(),
    type: z.enum([
      'signature_required', 'certificate_required', 'provenance_required',
      'vulnerability_scan', 'license_check', 'source_verification',
      'build_reproducibility', 'dependency_check', 'trust_score_minimum'
    ]),
    parameters: z.record(z.any()),
    severity: z.enum(['info', 'warning', 'error', 'critical']),
    action: z.enum(['allow', 'warn', 'block', 'quarantine'])
  })),
  trustedSigners: z.array(z.object({
    name: z.string(),
    publicKey: z.string(),
    keyId: z.string(),
    validFrom: z.date(),
    validTo: z.date().optional(),
    permissions: z.array(z.string()),
    metadata: z.record(z.any())
  })),
  trustedSources: z.array(z.object({
    type: z.enum(['registry', 'repository', 'organization']),
    url: z.string(),
    verification: z.enum(['none', 'signature', 'certificate']),
    trustLevel: z.enum(['low', 'medium', 'high'])
  })),
  exceptions: z.array(z.object({
    pluginId: z.string(),
    reason: z.string(),
    expiresAt: z.date().optional(),
    approvedBy: z.string()
  })).optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string()
});

export const VerificationResultSchema = z.object({
  resultId: z.string().uuid(),
  pluginId: z.string(),
  pluginVersion: z.string(),
  verificationTime: z.date(),
  status: z.enum(['verified', 'failed', 'warning', 'pending']),
  trustScore: z.number().min(0).max(100),
  checks: z.array(z.object({
    checkType: z.string(),
    status: z.enum(['pass', 'fail', 'warning', 'skip']),
    message: z.string(),
    details: z.record(z.any()).optional(),
    impact: z.enum(['low', 'medium', 'high', 'critical'])
  })),
  recommendations: z.array(z.string()),
  riskFactors: z.array(z.object({
    factor: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string()
  })),
  compliance: z.object({
    policies: z.array(z.string()), // Policy IDs
    violations: z.array(z.object({
      policyId: z.string(),
      ruleId: z.string(),
      severity: z.string(),
      message: z.string()
    }))
  }),
  artifacts: z.array(z.object({
    type: z.enum(['signature', 'certificate', 'attestation', 'scan_report']),
    location: z.string(),
    hash: z.string()
  })).optional(),
  metadata: z.record(z.any())
});

export type PluginSignature = z.infer<typeof PluginSignatureSchema>;
export type PluginProvenance = z.infer<typeof PluginProvenanceSchema>;
export type TrustPolicy = z.infer<typeof TrustPolicySchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export interface CodeSigningKey {
  keyId: string;
  algorithm: string;
  publicKey: string;
  privateKey?: string; // Only for signing operations
  certificate?: string;
  validFrom: Date;
  validTo?: Date;
  permissions: string[];
  metadata: Record<string, any>;
}

export interface SupplyChainPolicy {
  requireSourceVerification: boolean;
  requireBuildReproducibility: boolean;
  allowedSourceRepositories: string[];
  requiredAttestations: string[];
  maxVulnerabilityScore: number;
  blockedLicenses: string[];
  requiredScanners: string[];
  minimumTrustScore: number;
}

export class PluginVerifier {
  private signatures: Map<string, PluginSignature> = new Map();
  private provenanceRecords: Map<string, PluginProvenance> = new Map();
  private trustPolicies: Map<string, TrustPolicy> = new Map();
  private verificationResults: Map<string, VerificationResult> = new Map();
  private signingKeys: Map<string, CodeSigningKey> = new Map();
  private auditLogger: AuditLogger;
  private threatDetector: ThreatDetector;
  private supplyChainPolicy: SupplyChainPolicy;

  constructor() {
    this.auditLogger = new AuditLogger();
    this.threatDetector = new ThreatDetector();
    this.supplyChainPolicy = this.getDefaultSupplyChainPolicy();
    this.initializeDefaultTrustPolicies();
    this.initializeSigningInfrastructure();
  }

  /**
   * Sign a plugin with digital signature
   */
  async signPlugin(
    pluginId: string,
    pluginVersion: string,
    pluginContent: Buffer | string,
    signingKeyId: string,
    metadata?: Record<string, any>
  ): Promise<PluginSignature> {
    const signingKey = this.signingKeys.get(signingKeyId);
    if (!signingKey) {
      throw new Error('Signing key not found');
    }

    if (!signingKey.privateKey) {
      throw new Error('Private key not available for signing');
    }

    // Check key validity
    if (signingKey.validTo && signingKey.validTo < new Date()) {
      throw new Error('Signing key has expired');
    }

    // Calculate content hash
    const contentBuffer = Buffer.isBuffer(pluginContent) 
      ? pluginContent 
      : Buffer.from(pluginContent);
    const contentHash = createHash('sha256').update(contentBuffer).digest();

    // Create signature payload
    const signaturePayload = JSON.stringify({
      pluginId,
      pluginVersion,
      contentHash: contentHash.toString('hex'),
      timestamp: new Date().toISOString(),
      keyId: signingKeyId
    });

    // Generate signature
    const sign = createSign(signingKey.algorithm);
    sign.update(signaturePayload);
    sign.end();
    const signature = sign.sign(signingKey.privateKey, 'base64');

    // Create signature record
    const pluginSignature: PluginSignature = {
      signatureId: crypto.randomUUID(),
      pluginId,
      pluginVersion,
      algorithm: signingKey.algorithm as any,
      signature,
      publicKey: signingKey.publicKey,
      certificateChain: signingKey.certificate ? [signingKey.certificate] : undefined,
      signedAt: new Date(),
      expiresAt: signingKey.validTo,
      metadata: {
        ...metadata,
        contentHash: contentHash.toString('hex'),
        signingKeyId,
        signaturePayload
      },
      status: 'valid'
    };

    // Validate signature schema
    const validationResult = PluginSignatureSchema.safeParse(pluginSignature);
    if (!validationResult.success) {
      throw new Error(`Invalid signature: ${validationResult.error.message}`);
    }

    // Store signature
    this.signatures.set(pluginSignature.signatureId, pluginSignature);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'PLUGIN_SIGNED',
      pluginId,
      details: {
        pluginVersion,
        signatureId: pluginSignature.signatureId,
        algorithm: pluginSignature.algorithm,
        keyId: signingKeyId
      }
    });

    return pluginSignature;
  }

  /**
   * Verify plugin signature and trust
   */
  async verifyPlugin(
    pluginId: string,
    pluginVersion: string,
    pluginContent: Buffer | string,
    policyIds?: string[]
  ): Promise<VerificationResult> {
    const resultId = crypto.randomUUID();
    const verificationTime = new Date();

    // Find plugin signatures
    const signatures = Array.from(this.signatures.values())
      .filter(s => s.pluginId === pluginId && s.pluginVersion === pluginVersion);

    if (signatures.length === 0) {
      const result: VerificationResult = {
        resultId,
        pluginId,
        pluginVersion,
        verificationTime,
        status: 'failed',
        trustScore: 0,
        checks: [{
          checkType: 'signature_verification',
          status: 'fail',
          message: 'No signatures found for plugin',
          impact: 'critical'
        }],
        recommendations: ['Plugin must be signed before use'],
        riskFactors: [{
          factor: 'unsigned_plugin',
          severity: 'critical',
          description: 'Plugin lacks digital signature verification'
        }],
        compliance: { policies: [], violations: [] },
        metadata: {}
      };

      this.verificationResults.set(resultId, result);
      return result;
    }

    const checks: VerificationResult['checks'] = [];
    const riskFactors: VerificationResult['riskFactors'] = [];
    const recommendations: string[] = [];
    let trustScore = 100;

    // Verify each signature
    for (const signature of signatures) {
      const signatureCheck = await this.verifySignature(signature, pluginContent);
      checks.push(signatureCheck);
      
      if (signatureCheck.status === 'fail') {
        trustScore -= 30;
        riskFactors.push({
          factor: 'invalid_signature',
          severity: 'critical',
          description: 'Plugin signature verification failed'
        });
      }
    }

    // Check provenance if available
    const provenance = this.getPluginProvenance(pluginId, pluginVersion);
    if (provenance) {
      const provenanceCheck = await this.verifyProvenance(provenance);
      checks.push(provenanceCheck);
      trustScore = Math.min(trustScore, provenance.trustScore);
    } else {
      checks.push({
        checkType: 'provenance_verification',
        status: 'warning',
        message: 'No provenance information available',
        impact: 'medium'
      });
      trustScore -= 15;
      recommendations.push('Add provenance information for better trust verification');
    }

    // Apply trust policies
    const applicablePolicies = this.getApplicablePolicies(pluginId, policyIds);
    const policyCompliance = await this.checkPolicyCompliance(
      pluginId, pluginVersion, signatures, provenance, applicablePolicies
    );
    
    checks.push(...policyCompliance.checks);
    trustScore -= policyCompliance.violations.length * 10;

    // Perform additional security checks
    const securityChecks = await this.performSecurityChecks(pluginId, pluginContent);
    checks.push(...securityChecks.checks);
    riskFactors.push(...securityChecks.riskFactors);
    trustScore -= securityChecks.riskReduction;

    // Determine overall status
    const criticalFailures = checks.filter(c => c.status === 'fail' && c.impact === 'critical');
    const status = criticalFailures.length > 0 ? 'failed' : 
                  checks.some(c => c.status === 'fail') ? 'warning' : 'verified';

    // Create verification result
    const result: VerificationResult = {
      resultId,
      pluginId,
      pluginVersion,
      verificationTime,
      status,
      trustScore: Math.max(0, trustScore),
      checks,
      recommendations: [...recommendations, ...this.generateRecommendations(checks, riskFactors)],
      riskFactors,
      compliance: {
        policies: applicablePolicies.map(p => p.policyId),
        violations: policyCompliance.violations
      },
      artifacts: this.generateVerificationArtifacts(signatures, provenance),
      metadata: {
        signaturesVerified: signatures.length,
        provenanceAvailable: !!provenance,
        policiesApplied: applicablePolicies.length
      }
    };

    // Validate result schema
    const validationResult = VerificationResultSchema.safeParse(result);
    if (!validationResult.success) {
      throw new Error(`Invalid verification result: ${validationResult.error.message}`);
    }

    // Store result
    this.verificationResults.set(resultId, result);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'PLUGIN_VERIFIED',
      pluginId,
      details: {
        pluginVersion,
        resultId,
        status,
        trustScore: result.trustScore,
        signaturesVerified: signatures.length,
        policyViolations: policyCompliance.violations.length
      }
    });

    // Report high-risk plugins
    if (status === 'failed' || trustScore < 50) {
      await this.threatDetector.reportSecurityEvent({
        type: 'untrusted_plugin',
        severity: 'high',
        context: {
          pluginId,
          pluginVersion,
          trustScore,
          status,
          riskFactors
        }
      });
    }

    return result;
  }

  /**
   * Create plugin provenance record
   */
  async createProvenance(provenanceData: Omit<PluginProvenance, 'provenanceId' | 'createdAt' | 'trustScore'>): Promise<PluginProvenance> {
    const provenance: PluginProvenance = {
      provenanceId: crypto.randomUUID(),
      ...provenanceData,
      createdAt: new Date(),
      trustScore: await this.calculateProvenanceTrustScore(provenanceData)
    };

    // Validate provenance schema
    const validationResult = PluginProvenanceSchema.safeParse(provenance);
    if (!validationResult.success) {
      throw new Error(`Invalid provenance: ${validationResult.error.message}`);
    }

    // Store provenance
    const key = `${provenance.pluginId}:${provenance.pluginVersion}`;
    this.provenanceRecords.set(key, provenance);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'PLUGIN_PROVENANCE_CREATED',
      pluginId: provenance.pluginId,
      details: {
        pluginVersion: provenance.pluginVersion,
        provenanceId: provenance.provenanceId,
        trustScore: provenance.trustScore,
        builder: provenance.buildInfo.builder
      }
    });

    return provenance;
  }

  /**
   * Create trust policy
   */
  async createTrustPolicy(policyData: Omit<TrustPolicy, 'policyId' | 'createdAt' | 'updatedAt'>): Promise<TrustPolicy> {
    const policy: TrustPolicy = {
      policyId: crypto.randomUUID(),
      ...policyData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate policy schema
    const validationResult = TrustPolicySchema.safeParse(policy);
    if (!validationResult.success) {
      throw new Error(`Invalid trust policy: ${validationResult.error.message}`);
    }

    // Store policy
    this.trustPolicies.set(policy.policyId, policy);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'TRUST_POLICY_CREATED',
      details: {
        policyId: policy.policyId,
        name: policy.name,
        scope: policy.scope,
        rulesCount: policy.rules.length
      }
    });

    return policy;
  }

  /**
   * Generate signing key pair
   */
  async generateSigningKey(
    keyData: {
      algorithm: 'RSA-SHA256' | 'ECDSA-SHA256' | 'Ed25519';
      keySize?: number;
      validFor?: number; // days
      permissions: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<CodeSigningKey> {
    let keyPair: { publicKey: string; privateKey: string };
    
    switch (keyData.algorithm) {
      case 'RSA-SHA256':
        const rsaKeys = generateKeyPairSync('rsa', {
          modulusLength: keyData.keySize || 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        keyPair = rsaKeys;
        break;
      
      case 'ECDSA-SHA256':
        const ecdsaKeys = generateKeyPairSync('ec', {
          namedCurve: 'prime256v1',
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        keyPair = ecdsaKeys;
        break;
        
      case 'Ed25519':
        const ed25519Keys = generateKeyPairSync('ed25519', {
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        keyPair = ed25519Keys;
        break;
        
      default:
        throw new Error(`Unsupported algorithm: ${keyData.algorithm}`);
    }

    const keyId = crypto.randomUUID();
    const validTo = keyData.validFor 
      ? new Date(Date.now() + keyData.validFor * 24 * 60 * 60 * 1000)
      : undefined;

    const signingKey: CodeSigningKey = {
      keyId,
      algorithm: keyData.algorithm,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      validFrom: new Date(),
      validTo,
      permissions: keyData.permissions,
      metadata: keyData.metadata || {}
    };

    this.signingKeys.set(keyId, signingKey);

    await this.auditLogger.logSecurityEvent({
      eventType: 'SIGNING_KEY_GENERATED',
      details: {
        keyId,
        algorithm: keyData.algorithm,
        permissions: keyData.permissions,
        validTo
      }
    });

    return signingKey;
  }

  /**
   * Get verification result by ID
   */
  getVerificationResult(resultId: string): VerificationResult | undefined {
    return this.verificationResults.get(resultId);
  }

  /**
   * Get plugin provenance
   */
  getPluginProvenance(pluginId: string, pluginVersion: string): PluginProvenance | undefined {
    const key = `${pluginId}:${pluginVersion}`;
    return this.provenanceRecords.get(key);
  }

  /**
   * List trust policies
   */
  getTrustPolicies(scope?: TrustPolicy['scope']): TrustPolicy[] {
    const policies = Array.from(this.trustPolicies.values());
    return scope ? policies.filter(p => p.scope === scope) : policies;
  }

  /**
   * Get verification statistics
   */
  getVerificationStatistics(): {
    total: number;
    byStatus: Record<string, number>;
    trustScoreDistribution: { range: string; count: number }[];
    topRiskFactors: { factor: string; count: number }[];
    policyCompliance: {
      totalPolicies: number;
      compliantPlugins: number;
      violationsByPolicy: { policyId: string; violations: number }[];
    };
    trends: {
      daily: { date: string; verified: number; failed: number }[];
      trustScoreTrend: { date: string; averageScore: number }[];
    };
  } {
    const results = Array.from(this.verificationResults.values());
    
    // Status distribution
    const byStatus: Record<string, number> = {};
    results.forEach(r => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    // Trust score distribution
    const trustScoreRanges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 }
    ];
    
    const trustScoreDistribution = trustScoreRanges.map(range => ({
      range: range.range,
      count: results.filter(r => r.trustScore >= range.min && r.trustScore <= range.max).length
    }));

    // Top risk factors
    const riskFactorCounts: Record<string, number> = {};
    results.forEach(r => {
      r.riskFactors.forEach(rf => {
        riskFactorCounts[rf.factor] = (riskFactorCounts[rf.factor] || 0) + 1;
      });
    });
    
    const topRiskFactors = Object.entries(riskFactorCounts)
      .map(([factor, count]) => ({ factor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Policy compliance
    const violationsByPolicy: Record<string, number> = {};
    results.forEach(r => {
      r.compliance.violations.forEach(v => {
        violationsByPolicy[v.policyId] = (violationsByPolicy[v.policyId] || 0) + 1;
      });
    });

    return {
      total: results.length,
      byStatus,
      trustScoreDistribution,
      topRiskFactors,
      policyCompliance: {
        totalPolicies: this.trustPolicies.size,
        compliantPlugins: results.filter(r => r.compliance.violations.length === 0).length,
        violationsByPolicy: Object.entries(violationsByPolicy).map(([policyId, violations]) => ({ policyId, violations }))
      },
      trends: {
        daily: this.calculateDailyVerificationTrends(results),
        trustScoreTrend: this.calculateTrustScoreTrends(results)
      }
    };
  }

  // Private helper methods
  private async verifySignature(signature: PluginSignature, pluginContent: Buffer | string): Promise<VerificationResult['checks'][0]> {
    try {
      // Check signature expiration
      if (signature.expiresAt && signature.expiresAt < new Date()) {
        return {
          checkType: 'signature_verification',
          status: 'fail',
          message: 'Signature has expired',
          impact: 'high'
        };
      }

      // Check signature status
      if (signature.status !== 'valid') {
        return {
          checkType: 'signature_verification',
          status: 'fail',
          message: `Signature status is ${signature.status}`,
          impact: 'critical'
        };
      }

      // Verify signature
      const contentBuffer = Buffer.isBuffer(pluginContent) 
        ? pluginContent 
        : Buffer.from(pluginContent);
      const contentHash = createHash('sha256').update(contentBuffer).digest('hex');

      const signaturePayload = JSON.stringify({
        pluginId: signature.pluginId,
        pluginVersion: signature.pluginVersion,
        contentHash,
        timestamp: signature.signedAt.toISOString(),
        keyId: signature.metadata?.signingKeyId
      });

      const verify = createVerify(signature.algorithm);
      verify.update(signaturePayload);
      verify.end();

      const isValid = verify.verify(signature.publicKey, signature.signature, 'base64');

      return {
        checkType: 'signature_verification',
        status: isValid ? 'pass' : 'fail',
        message: isValid ? 'Signature verification successful' : 'Signature verification failed',
        details: {
          algorithm: signature.algorithm,
          signedAt: signature.signedAt,
          contentHash
        },
        impact: isValid ? 'low' : 'critical'
      };
    } catch (error) {
      return {
        checkType: 'signature_verification',
        status: 'fail',
        message: `Signature verification error: ${error.message}`,
        impact: 'critical'
      };
    }
  }

  private async verifyProvenance(provenance: PluginProvenance): Promise<VerificationResult['checks'][0]> {
    const issues: string[] = [];
    
    // Check supply chain verification
    if (!provenance.supplyChain.sourceVerified) {
      issues.push('Source not verified');
    }
    if (!provenance.supplyChain.dependenciesVerified) {
      issues.push('Dependencies not verified');
    }
    if (!provenance.supplyChain.vulnerabilitiesScanned) {
      issues.push('Vulnerabilities not scanned');
    }

    // Check for high-risk dependencies
    const highRiskDeps = provenance.dependencies.filter(dep => 
      dep.vulnerabilities && dep.vulnerabilities.length > 0
    );
    if (highRiskDeps.length > 0) {
      issues.push(`${highRiskDeps.length} dependencies with vulnerabilities`);
    }

    const status = issues.length === 0 ? 'pass' : issues.length <= 2 ? 'warning' : 'fail';
    
    return {
      checkType: 'provenance_verification',
      status,
      message: status === 'pass' 
        ? 'Provenance verification successful'
        : `Provenance issues: ${issues.join(', ')}`,
      details: {
        trustScore: provenance.trustScore,
        buildReproducible: provenance.supplyChain.buildReproducible,
        dependencyCount: provenance.dependencies.length,
        attestationCount: provenance.attestations.length
      },
      impact: status === 'fail' ? 'high' : status === 'warning' ? 'medium' : 'low'
    };
  }

  private getApplicablePolicies(pluginId: string, policyIds?: string[]): TrustPolicy[] {
    let policies = Array.from(this.trustPolicies.values()).filter(p => p.isActive);
    
    if (policyIds) {
      policies = policies.filter(p => policyIds.includes(p.policyId));
    }

    // Apply scope-based filtering
    policies = policies.filter(policy => {
      switch (policy.scope) {
        case 'global':
          return true;
        case 'plugin':
          return policy.name.includes(pluginId); // Simplified check
        default:
          return true;
      }
    });

    return policies;
  }

  private async checkPolicyCompliance(
    pluginId: string,
    pluginVersion: string,
    signatures: PluginSignature[],
    provenance: PluginProvenance | undefined,
    policies: TrustPolicy[]
  ): Promise<{
    checks: VerificationResult['checks'];
    violations: VerificationResult['compliance']['violations'];
  }> {
    const checks: VerificationResult['checks'] = [];
    const violations: VerificationResult['compliance']['violations'] = [];

    for (const policy of policies) {
      for (const rule of policy.rules) {
        const ruleCheck = await this.evaluatePolicyRule(rule, {
          pluginId,
          pluginVersion,
          signatures,
          provenance
        });

        checks.push({
          checkType: `policy_${rule.type}`,
          status: ruleCheck.compliant ? 'pass' : 'fail',
          message: ruleCheck.message,
          details: { policyId: policy.policyId, ruleId: rule.ruleId },
          impact: rule.severity === 'critical' ? 'critical' : 
                  rule.severity === 'error' ? 'high' :
                  rule.severity === 'warning' ? 'medium' : 'low'
        });

        if (!ruleCheck.compliant && rule.action !== 'allow') {
          violations.push({
            policyId: policy.policyId,
            ruleId: rule.ruleId,
            severity: rule.severity,
            message: ruleCheck.message
          });
        }
      }
    }

    return { checks, violations };
  }

  private async evaluatePolicyRule(rule: any, context: any): Promise<{ compliant: boolean; message: string }> {
    switch (rule.type) {
      case 'signature_required':
        return {
          compliant: context.signatures.length > 0,
          message: context.signatures.length > 0 
            ? 'Plugin has valid signatures'
            : 'Plugin signature required'
        };
      
      case 'provenance_required':
        return {
          compliant: !!context.provenance,
          message: context.provenance 
            ? 'Provenance information available'
            : 'Provenance information required'
        };
      
      case 'trust_score_minimum':
        const minScore = rule.parameters.minimumScore || 70;
        const actualScore = context.provenance?.trustScore || 0;
        return {
          compliant: actualScore >= minScore,
          message: `Trust score ${actualScore} (required: ${minScore})`
        };
      
      default:
        return { compliant: true, message: 'Rule evaluation not implemented' };
    }
  }

  private async performSecurityChecks(pluginId: string, pluginContent: Buffer | string): Promise<{
    checks: VerificationResult['checks'];
    riskFactors: VerificationResult['riskFactors'];
    riskReduction: number;
  }> {
    const checks: VerificationResult['checks'] = [];
    const riskFactors: VerificationResult['riskFactors'] = [];
    let riskReduction = 0;

    // Content analysis
    const contentString = Buffer.isBuffer(pluginContent) 
      ? pluginContent.toString()
      : pluginContent;

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /eval\s*\(/gi, risk: 'code_injection', severity: 'high' as const },
      { pattern: /Function\s*\(/gi, risk: 'dynamic_code', severity: 'medium' as const },
      { pattern: /document\.cookie/gi, risk: 'cookie_access', severity: 'medium' as const },
      { pattern: /localStorage/gi, risk: 'local_storage_access', severity: 'low' as const },
      { pattern: /XMLHttpRequest|fetch/gi, risk: 'network_access', severity: 'medium' as const }
    ];

    for (const { pattern, risk, severity } of suspiciousPatterns) {
      const matches = contentString.match(pattern);
      if (matches) {
        riskFactors.push({
          factor: risk,
          severity,
          description: `Found ${matches.length} instances of ${pattern.source}`
        });
        
        riskReduction += severity === 'high' ? 20 : severity === 'medium' ? 10 : 5;
      }
    }

    // Size check
    const contentSize = Buffer.byteLength(contentString);
    if (contentSize > 10 * 1024 * 1024) { // 10MB
      riskFactors.push({
        factor: 'large_plugin_size',
        severity: 'medium',
        description: `Plugin size ${Math.round(contentSize / 1024 / 1024)}MB exceeds recommended limit`
      });
      riskReduction += 5;
    }

    checks.push({
      checkType: 'security_analysis',
      status: riskFactors.length === 0 ? 'pass' : riskFactors.some(rf => rf.severity === 'high') ? 'fail' : 'warning',
      message: riskFactors.length === 0 
        ? 'No security risks detected'
        : `Found ${riskFactors.length} potential security risks`,
      details: { 
        riskFactors: riskFactors.map(rf => rf.factor),
        contentSize 
      },
      impact: riskFactors.some(rf => rf.severity === 'high') ? 'high' : 
              riskFactors.some(rf => rf.severity === 'medium') ? 'medium' : 'low'
    });

    return { checks, riskFactors, riskReduction };
  }

  private generateRecommendations(checks: VerificationResult['checks'], riskFactors: VerificationResult['riskFactors']): string[] {
    const recommendations: string[] = [];
    
    const failedChecks = checks.filter(c => c.status === 'fail');
    if (failedChecks.length > 0) {
      recommendations.push('Address failed verification checks before deployment');
    }

    const highRisks = riskFactors.filter(rf => rf.severity === 'high');
    if (highRisks.length > 0) {
      recommendations.push('Review and mitigate high-severity security risks');
    }

    if (checks.some(c => c.checkType === 'provenance_verification' && c.status !== 'pass')) {
      recommendations.push('Add comprehensive provenance information');
    }

    return recommendations;
  }

  private generateVerificationArtifacts(signatures: PluginSignature[], provenance?: PluginProvenance): VerificationResult['artifacts'] {
    const artifacts: VerificationResult['artifacts'] = [];
    
    signatures.forEach(sig => {
      artifacts.push({
        type: 'signature',
        location: `signatures/${sig.signatureId}`,
        hash: createHash('sha256').update(sig.signature).digest('hex')
      });
    });

    if (provenance) {
      artifacts.push({
        type: 'attestation',
        location: `provenance/${provenance.provenanceId}`,
        hash: createHash('sha256').update(JSON.stringify(provenance)).digest('hex')
      });
    }

    return artifacts;
  }

  private async calculateProvenanceTrustScore(provenance: Omit<PluginProvenance, 'provenanceId' | 'createdAt' | 'trustScore'>): Promise<number> {
    let score = 100;
    
    // Deduct for supply chain issues
    if (!provenance.supplyChain.sourceVerified) score -= 20;
    if (!provenance.supplyChain.buildReproducible) score -= 15;
    if (!provenance.supplyChain.dependenciesVerified) score -= 15;
    if (!provenance.supplyChain.vulnerabilitiesScanned) score -= 10;
    if (!provenance.supplyChain.licenseCompliant) score -= 5;

    // Deduct for vulnerabilities
    const vulnerableDepCount = provenance.dependencies.filter(dep => 
      dep.vulnerabilities && dep.vulnerabilities.length > 0
    ).length;
    score -= vulnerableDepCount * 5;

    // Bonus for attestations
    score += Math.min(15, provenance.attestations.length * 5);

    return Math.max(0, Math.min(100, score));
  }

  private initializeDefaultTrustPolicies(): void {
    // Initialize with default security policies
    const defaultPolicy: Omit<TrustPolicy, 'policyId' | 'createdAt' | 'updatedAt'> = {
      name: 'Default Security Policy',
      description: 'Standard security requirements for all plugins',
      scope: 'global',
      rules: [
        {
          ruleId: 'require-signature',
          type: 'signature_required',
          parameters: {},
          severity: 'critical',
          action: 'block'
        },
        {
          ruleId: 'min-trust-score',
          type: 'trust_score_minimum',
          parameters: { minimumScore: 70 },
          severity: 'error',
          action: 'warn'
        }
      ],
      trustedSigners: [],
      trustedSources: [
        {
          type: 'registry',
          url: 'https://plugins.portal.internal',
          verification: 'signature',
          trustLevel: 'high'
        }
      ],
      isActive: true,
      createdBy: 'system'
    };

    this.createTrustPolicy(defaultPolicy);
  }

  private initializeSigningInfrastructure(): void {
    // Initialize default signing keys would be done here
    // In production, this would load from secure key storage
  }

  private getDefaultSupplyChainPolicy(): SupplyChainPolicy {
    return {
      requireSourceVerification: true,
      requireBuildReproducibility: false,
      allowedSourceRepositories: [
        'https://github.com/organization/*',
        'https://gitlab.com/organization/*'
      ],
      requiredAttestations: ['slsa'],
      maxVulnerabilityScore: 7.0, // CVSS score
      blockedLicenses: ['GPL-3.0', 'AGPL-3.0'],
      requiredScanners: ['vulnerability', 'license'],
      minimumTrustScore: 70
    };
  }

  private calculateDailyVerificationTrends(results: VerificationResult[]): any[] {
    // Mock daily trends - in production would calculate from actual data
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        verified: Math.floor(Math.random() * 50),
        failed: Math.floor(Math.random() * 10)
      };
    }).reverse();
  }

  private calculateTrustScoreTrends(results: VerificationResult[]): any[] {
    // Mock trust score trends
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        averageScore: 70 + Math.floor(Math.random() * 20)
      };
    }).reverse();
  }
}

export { PluginVerifier };