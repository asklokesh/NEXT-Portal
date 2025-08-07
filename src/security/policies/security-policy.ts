/**
 * Security Policy Engine
 * Manages security policies, runtime monitoring, and enforcement
 * Implements comprehensive policy validation and compliance checking
 */

import { z } from 'zod';
import { AuditLogger } from '../logging/audit-logger';
import { ThreatDetector } from '../detection/threat-detector';

// Security Policy Schema Definitions
export const ResourceLimitsSchema = z.object({
  cpu: z.string().regex(/^\d+(\.\d+)?(m|)$/),
  memory: z.string().regex(/^\d+(\.\d+)?(Ki|Mi|Gi|Ti|)$/),
  storage: z.string().regex(/^\d+(\.\d+)?(Ki|Mi|Gi|Ti|)$/),
  networkBandwidth: z.string().regex(/^\d+(\.\d+)?(Kbps|Mbps|Gbps|)$/),
  maxConnections: z.number().min(1).max(10000),
  maxFileDescriptors: z.number().min(1).max(65536),
  maxProcesses: z.number().min(1).max(1000),
  executionTimeLimit: z.number().min(1).max(86400) // Max 24 hours
});

export const NetworkPolicySchema = z.object({
  allowedEgress: z.array(z.string().min(1)),
  allowedIngress: z.array(z.string().min(1)),
  dnsPolicy: z.enum(['ClusterFirst', 'None', 'Default']),
  enableServiceMesh: z.boolean(),
  requireTLS: z.boolean(),
  allowedPorts: z.array(z.number().min(1).max(65535)),
  blockedDomains: z.array(z.string().min(1))
});

export const SecurityContextSchema = z.object({
  runAsNonRoot: z.boolean(),
  runAsUser: z.number().min(1000).max(65534),
  runAsGroup: z.number().min(1000).max(65534),
  readOnlyRootFilesystem: z.boolean(),
  allowPrivilegeEscalation: z.boolean(),
  capabilities: z.object({
    drop: z.array(z.string()),
    add: z.array(z.string())
  }),
  seLinuxOptions: z.object({
    level: z.string(),
    role: z.string(),
    type: z.string(),
    user: z.string()
  }).optional(),
  seccompProfile: z.object({
    type: z.string(),
    localhostProfile: z.string().optional()
  }).optional()
});

export const SecurityPolicySchema = z.object({
  policyId: z.string().uuid(),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum([
    'access_control', 'network_security', 'data_protection',
    'resource_management', 'runtime_behavior', 'compliance'
  ]),
  rules: z.array(z.object({
    ruleId: z.string(),
    name: z.string(),
    description: z.string(),
    condition: z.string(), // JSONPath or CEL expression
    action: z.enum(['allow', 'deny', 'warn', 'audit']),
    parameters: z.record(z.any()).optional()
  })),
  resourceLimits: ResourceLimitsSchema.optional(),
  networkPolicy: NetworkPolicySchema.optional(),
  securityContext: SecurityContextSchema.optional(),
  compliance: z.object({
    standards: z.array(z.enum(['SOC2', 'GDPR', 'HIPAA', 'PCI_DSS', 'ISO27001'])),
    requirements: z.array(z.string()),
    evidence: z.array(z.object({
      type: z.string(),
      description: z.string(),
      location: z.string()
    }))
  }).optional(),
  metadata: z.record(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  isActive: z.boolean()
});

export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>;
export type SecurityRule = SecurityPolicy['rules'][0];

export interface PolicyEvaluationContext {
  pluginId: string;
  instanceId: string;
  userId: string;
  operation: string;
  resource: string;
  attributes: Record<string, any>;
  environment: 'development' | 'staging' | 'production';
  timestamp: Date;
}

export interface PolicyEvaluationResult {
  policyId: string;
  decision: 'allow' | 'deny' | 'warn';
  matchedRules: SecurityRule[];
  violations: PolicyViolation[];
  recommendations: string[];
  riskScore: number;
  complianceStatus: ComplianceStatus;
}

export interface PolicyViolation {
  violationId: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  evidence: Record<string, any>;
  timestamp: Date;
}

export interface ComplianceStatus {
  overall: 'compliant' | 'non-compliant' | 'partial' | 'unknown';
  standards: {
    [standard: string]: {
      status: 'compliant' | 'non-compliant' | 'partial' | 'unknown';
      requirements: {
        [requirement: string]: boolean;
      };
      score: number;
    };
  };
  lastAssessment: Date;
  nextAssessment: Date;
}

export interface RuntimeMonitoringConfig {
  enabled: boolean;
  samplingRate: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    resourceUsage: number;
    securityEvents: number;
  };
  monitoring: {
    performance: boolean;
    security: boolean;
    compliance: boolean;
    behavior: boolean;
  };
}

export class SecurityPolicyEngine {
  private policies: Map<string, SecurityPolicy> = new Map();
  private auditLogger: AuditLogger;
  private threatDetector: ThreatDetector;
  private monitoringConfig: RuntimeMonitoringConfig;
  private policyCache: Map<string, PolicyEvaluationResult> = new Map();

  constructor() {
    this.auditLogger = new AuditLogger();
    this.threatDetector = new ThreatDetector();
    this.monitoringConfig = this.getDefaultMonitoringConfig();
    this.loadDefaultPolicies();
  }

  /**
   * Create a new security policy
   */
  async createPolicy(policyData: Partial<SecurityPolicy>): Promise<SecurityPolicy> {
    const now = new Date();
    const policy: SecurityPolicy = {
      policyId: crypto.randomUUID(),
      name: policyData.name!,
      version: policyData.version || '1.0.0',
      description: policyData.description || '',
      severity: policyData.severity || 'medium',
      category: policyData.category!,
      rules: policyData.rules || [],
      resourceLimits: policyData.resourceLimits,
      networkPolicy: policyData.networkPolicy,
      securityContext: policyData.securityContext,
      compliance: policyData.compliance,
      metadata: policyData.metadata || {},
      createdAt: now,
      updatedAt: now,
      createdBy: policyData.createdBy || 'system',
      isActive: policyData.isActive ?? true
    };

    // Validate policy schema
    const validationResult = SecurityPolicySchema.safeParse(policy);
    if (!validationResult.success) {
      throw new Error(`Invalid policy schema: ${validationResult.error.message}`);
    }

    // Store policy
    this.policies.set(policy.policyId, policy);

    // Clear relevant cache entries
    this.invalidateCache(policy);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'POLICY_CREATED',
      policyId: policy.policyId,
      details: { name: policy.name, category: policy.category }
    });

    return policy;
  }

  /**
   * Update an existing security policy
   */
  async updatePolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<SecurityPolicy> {
    const existingPolicy = this.policies.get(policyId);
    if (!existingPolicy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    const updatedPolicy: SecurityPolicy = {
      ...existingPolicy,
      ...updates,
      policyId, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    // Validate updated policy
    const validationResult = SecurityPolicySchema.safeParse(updatedPolicy);
    if (!validationResult.success) {
      throw new Error(`Invalid policy update: ${validationResult.error.message}`);
    }

    // Store updated policy
    this.policies.set(policyId, updatedPolicy);

    // Clear relevant cache entries
    this.invalidateCache(updatedPolicy);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'POLICY_UPDATED',
      policyId,
      details: { changes: updates }
    });

    return updatedPolicy;
  }

  /**
   * Delete a security policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    // Check if policy is referenced by active sandboxes
    const referencedBy = await this.getPolicyReferences(policyId);
    if (referencedBy.length > 0) {
      throw new Error(`Cannot delete policy ${policyId}: referenced by ${referencedBy.length} active sandboxes`);
    }

    // Delete policy
    this.policies.delete(policyId);

    // Clear cache
    this.invalidateCache(policy);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'POLICY_DELETED',
      policyId,
      details: { name: policy.name }
    });
  }

  /**
   * Evaluate security policies for a given context
   */
  async evaluatePolicies(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult[]> {
    const cacheKey = this.generateCacheKey(context);
    const cached = this.policyCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached, context)) {
      return [cached];
    }

    const results: PolicyEvaluationResult[] = [];
    const applicablePolicies = this.getApplicablePolicies(context);

    for (const policy of applicablePolicies) {
      const result = await this.evaluatePolicy(policy, context);
      results.push(result);

      // Cache the result
      this.policyCache.set(cacheKey, result);
    }

    // Log evaluation
    await this.auditLogger.logSecurityEvent({
      eventType: 'POLICY_EVALUATION',
      pluginId: context.pluginId,
      instanceId: context.instanceId,
      details: {
        operation: context.operation,
        evaluatedPolicies: results.length,
        violations: results.flatMap(r => r.violations).length
      }
    });

    return results;
  }

  /**
   * Get all active security policies
   */
  getActivePolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values()).filter(policy => policy.isActive);
  }

  /**
   * Get a specific policy by ID
   */
  getPolicy(policyId: string): SecurityPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get policies by category
   */
  getPoliciesByCategory(category: SecurityPolicy['category']): SecurityPolicy[] {
    return this.getActivePolicies().filter(policy => policy.category === category);
  }

  /**
   * Monitor runtime security events
   */
  async monitorRuntimeEvent(event: {
    eventType: string;
    pluginId: string;
    instanceId: string;
    details: Record<string, any>;
    timestamp?: Date;
  }): Promise<void> {
    if (!this.monitoringConfig.enabled) {
      return;
    }

    const timestamp = event.timestamp || new Date();
    
    // Sample based on configuration
    if (Math.random() > this.monitoringConfig.samplingRate) {
      return;
    }

    // Create evaluation context
    const context: PolicyEvaluationContext = {
      pluginId: event.pluginId,
      instanceId: event.instanceId,
      userId: event.details.userId || 'system',
      operation: event.eventType,
      resource: event.details.resource || 'unknown',
      attributes: event.details,
      environment: (process.env.NODE_ENV as any) || 'development',
      timestamp
    };

    // Evaluate policies
    const results = await this.evaluatePolicies(context);

    // Check for violations
    const violations = results.flatMap(r => r.violations);
    if (violations.length > 0) {
      await this.handlePolicyViolations(violations, context);
    }

    // Check alert thresholds
    await this.checkAlertThresholds(context, results);
  }

  /**
   * Get compliance status for a plugin
   */
  async getComplianceStatus(pluginId: string): Promise<ComplianceStatus> {
    const policies = this.getActivePolicies().filter(p => 
      p.compliance && p.compliance.standards.length > 0
    );

    const standards: ComplianceStatus['standards'] = {};
    
    for (const policy of policies) {
      if (!policy.compliance) continue;
      
      for (const standard of policy.compliance.standards) {
        if (!standards[standard]) {
          standards[standard] = {
            status: 'unknown',
            requirements: {},
            score: 0
          };
        }

        // Check requirements
        for (const requirement of policy.compliance.requirements) {
          const isCompliant = await this.checkComplianceRequirement(pluginId, standard, requirement);
          standards[standard].requirements[requirement] = isCompliant;
        }

        // Calculate score
        const totalRequirements = Object.keys(standards[standard].requirements).length;
        const compliantRequirements = Object.values(standards[standard].requirements).filter(Boolean).length;
        standards[standard].score = totalRequirements > 0 ? (compliantRequirements / totalRequirements) * 100 : 0;

        // Determine status
        if (standards[standard].score === 100) {
          standards[standard].status = 'compliant';
        } else if (standards[standard].score >= 80) {
          standards[standard].status = 'partial';
        } else {
          standards[standard].status = 'non-compliant';
        }
      }
    }

    // Calculate overall status
    const scores = Object.values(standards).map(s => s.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    let overall: ComplianceStatus['overall'] = 'unknown';
    if (avgScore === 100) overall = 'compliant';
    else if (avgScore >= 80) overall = 'partial';
    else if (avgScore > 0) overall = 'non-compliant';

    return {
      overall,
      standards,
      lastAssessment: new Date(),
      nextAssessment: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };
  }

  /**
   * Generate policy compliance report
   */
  async generateComplianceReport(pluginId?: string): Promise<{
    summary: {
      totalPolicies: number;
      compliantPolicies: number;
      complianceRate: number;
      lastUpdated: Date;
    };
    details: {
      pluginId?: string;
      policies: {
        policyId: string;
        name: string;
        status: 'compliant' | 'non-compliant' | 'partial';
        violations: number;
        lastChecked: Date;
      }[];
      recommendations: string[];
    };
  }> {
    const policies = this.getActivePolicies();
    const compliantPolicies = policies.filter(p => p.compliance).length;

    const policyDetails = await Promise.all(
      policies.map(async policy => {
        const violations = await this.getPolicyViolations(policy.policyId, pluginId);
        return {
          policyId: policy.policyId,
          name: policy.name,
          status: violations.length === 0 ? 'compliant' as const : 'non-compliant' as const,
          violations: violations.length,
          lastChecked: new Date()
        };
      })
    );

    const recommendations = await this.generateComplianceRecommendations(policyDetails);

    return {
      summary: {
        totalPolicies: policies.length,
        compliantPolicies,
        complianceRate: policies.length > 0 ? (compliantPolicies / policies.length) * 100 : 0,
        lastUpdated: new Date()
      },
      details: {
        pluginId,
        policies: policyDetails,
        recommendations
      }
    };
  }

  // Private helper methods
  private getDefaultMonitoringConfig(): RuntimeMonitoringConfig {
    return {
      enabled: true,
      samplingRate: 1.0, // 100% sampling by default
      alertThresholds: {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5 seconds
        resourceUsage: 0.8, // 80%
        securityEvents: 10 // 10 events per minute
      },
      monitoring: {
        performance: true,
        security: true,
        compliance: true,
        behavior: true
      }
    };
  }

  private loadDefaultPolicies(): void {
    // Load default security policies
    const defaultPolicies = this.getDefaultSecurityPolicies();
    defaultPolicies.forEach(policy => {
      this.policies.set(policy.policyId, policy);
    });
  }

  private getDefaultSecurityPolicies(): SecurityPolicy[] {
    const now = new Date();
    
    return [
      {
        policyId: crypto.randomUUID(),
        name: 'Strict Container Security',
        version: '1.0.0',
        description: 'Enforces strict container security controls',
        severity: 'critical',
        category: 'access_control',
        rules: [
          {
            ruleId: 'no-root-user',
            name: 'No Root User',
            description: 'Containers must not run as root',
            condition: '$.securityContext.runAsNonRoot == true',
            action: 'deny'
          },
          {
            ruleId: 'readonly-filesystem',
            name: 'Read-only Root Filesystem',
            description: 'Root filesystem must be read-only',
            condition: '$.securityContext.readOnlyRootFilesystem == true',
            action: 'deny'
          }
        ],
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 65534,
          runAsGroup: 65534,
          readOnlyRootFilesystem: true,
          allowPrivilegeEscalation: false,
          capabilities: {
            drop: ['ALL'],
            add: []
          }
        },
        metadata: { source: 'default' },
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        isActive: true
      }
    ];
  }

  private getApplicablePolicies(context: PolicyEvaluationContext): SecurityPolicy[] {
    return this.getActivePolicies().filter(policy => {
      // Filter based on context attributes
      return true; // Simplified - would have more complex filtering logic
    });
  }

  private async evaluatePolicy(policy: SecurityPolicy, context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    const matchedRules: SecurityRule[] = [];
    const violations: PolicyViolation[] = [];
    
    for (const rule of policy.rules) {
      const matches = await this.evaluateRule(rule, context);
      if (matches) {
        matchedRules.push(rule);
        
        if (rule.action === 'deny') {
          violations.push({
            violationId: crypto.randomUUID(),
            ruleId: rule.ruleId,
            severity: policy.severity,
            description: rule.description,
            remediation: `Ensure ${rule.name} requirement is met`,
            evidence: context.attributes,
            timestamp: context.timestamp
          });
        }
      }
    }

    const decision = violations.length > 0 ? 'deny' : 'allow';
    const riskScore = this.calculateRiskScore(violations, matchedRules);
    const complianceStatus = await this.getComplianceStatus(context.pluginId);

    return {
      policyId: policy.policyId,
      decision,
      matchedRules,
      violations,
      recommendations: this.generateRecommendations(violations),
      riskScore,
      complianceStatus
    };
  }

  private async evaluateRule(rule: SecurityRule, context: PolicyEvaluationContext): Promise<boolean> {
    // Simplified rule evaluation - would use JSONPath or CEL expression evaluation
    try {
      // This is a mock implementation
      return Math.random() > 0.8; // 20% chance of rule match
    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        eventType: 'RULE_EVALUATION_ERROR',
        ruleId: rule.ruleId,
        error: error.message
      });
      return false;
    }
  }

  private calculateRiskScore(violations: PolicyViolation[], rules: SecurityRule[]): number {
    if (violations.length === 0) return 0;

    const severityWeights = { low: 1, medium: 2, high: 3, critical: 4 };
    const totalWeight = violations.reduce((sum, v) => sum + severityWeights[v.severity], 0);
    
    return Math.min(100, (totalWeight / violations.length) * 25);
  }

  private generateRecommendations(violations: PolicyViolation[]): string[] {
    return violations.map(v => v.remediation);
  }

  private invalidateCache(policy: SecurityPolicy): void {
    // Clear cache entries related to this policy
    for (const [key, value] of this.policyCache.entries()) {
      if (value.policyId === policy.policyId) {
        this.policyCache.delete(key);
      }
    }
  }

  private generateCacheKey(context: PolicyEvaluationContext): string {
    return createHash('sha256')
      .update(JSON.stringify({
        pluginId: context.pluginId,
        operation: context.operation,
        resource: context.resource,
        environment: context.environment
      }))
      .digest('hex');
  }

  private isCacheValid(result: PolicyEvaluationResult, context: PolicyEvaluationContext): boolean {
    // Check if cache is still valid (e.g., within 5 minutes)
    const cacheAge = Date.now() - context.timestamp.getTime();
    return cacheAge < 5 * 60 * 1000; // 5 minutes
  }

  private async getPolicyReferences(policyId: string): Promise<string[]> {
    // Mock implementation - would query active sandboxes
    return [];
  }

  private async handlePolicyViolations(violations: PolicyViolation[], context: PolicyEvaluationContext): Promise<void> {
    for (const violation of violations) {
      await this.auditLogger.logSecurityEvent({
        eventType: 'POLICY_VIOLATION',
        pluginId: context.pluginId,
        instanceId: context.instanceId,
        violationId: violation.violationId,
        severity: violation.severity,
        details: violation
      });

      // Trigger threat detection if critical
      if (violation.severity === 'critical') {
        await this.threatDetector.reportSecurityEvent({
          type: 'policy_violation',
          severity: violation.severity,
          context,
          violation
        });
      }
    }
  }

  private async checkAlertThresholds(context: PolicyEvaluationContext, results: PolicyEvaluationResult[]): Promise<void> {
    const violations = results.flatMap(r => r.violations);
    const criticalViolations = violations.filter(v => v.severity === 'critical');

    if (criticalViolations.length >= this.monitoringConfig.alertThresholds.securityEvents) {
      // Trigger alert
      await this.auditLogger.logSecurityEvent({
        eventType: 'SECURITY_THRESHOLD_EXCEEDED',
        pluginId: context.pluginId,
        instanceId: context.instanceId,
        details: {
          threshold: this.monitoringConfig.alertThresholds.securityEvents,
          actual: criticalViolations.length
        }
      });
    }
  }

  private async checkComplianceRequirement(pluginId: string, standard: string, requirement: string): Promise<boolean> {
    // Mock implementation - would check actual compliance
    return Math.random() > 0.3; // 70% compliance rate
  }

  private async getPolicyViolations(policyId: string, pluginId?: string): Promise<PolicyViolation[]> {
    // Mock implementation - would query actual violations
    return [];
  }

  private async generateComplianceRecommendations(policies: any[]): Promise<string[]> {
    const nonCompliant = policies.filter(p => p.status !== 'compliant');
    return nonCompliant.map(p => `Address violations in policy: ${p.name}`);
  }
}

export { SecurityPolicyEngine };