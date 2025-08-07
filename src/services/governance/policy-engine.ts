/**
 * Policy Engine
 * Policy-as-Code framework with OPA integration for dynamic policy evaluation
 * Supports multi-level governance with custom policy definitions
 */

import { z } from 'zod';
import axios from 'axios';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';

// Policy Definition Schema
export const PolicyDefinitionSchema = z.object({
  id: z.string(),
  version: z.string(),
  metadata: z.object({
    name: z.string(),
    description: z.string(),
    category: z.enum(['security', 'compliance', 'quality', 'resource', 'access']),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    tags: z.array(z.string()).optional(),
    owner: z.string(),
    created: z.date(),
    modified: z.date()
  }),
  rules: z.array(z.object({
    id: z.string(),
    condition: z.string(),
    action: z.enum(['allow', 'deny', 'warn', 'require-approval']),
    message: z.string(),
    remediation: z.string().optional()
  })),
  scope: z.object({
    organization: z.array(z.string()).optional(),
    team: z.array(z.string()).optional(),
    service: z.array(z.string()).optional(),
    environment: z.array(z.string()).optional()
  }),
  enforcement: z.object({
    level: z.enum(['strict', 'advisory', 'warning']),
    exemptions: z.array(z.string()).optional(),
    approvers: z.array(z.string()).optional(),
    bypassable: z.boolean().default(false)
  }),
  rego: z.string() // OPA Rego policy code
});

export type PolicyDefinition = z.infer<typeof PolicyDefinitionSchema>;

// Policy Evaluation Result
export interface PolicyEvaluationResult {
  policyId: string;
  ruleName: string;
  decision: 'allow' | 'deny' | 'warn' | 'require-approval';
  message: string;
  remediation?: string;
  metadata: {
    severity: string;
    category: string;
    timestamp: Date;
    evaluationTime: number;
  };
  evidence?: Record<string, any>;
}

// Policy Bundle for OPA
export interface PolicyBundle {
  manifest: {
    revision: string;
    roots: string[];
  };
  data: Record<string, any>;
  policies: Record<string, string>;
}

// Policy Context for evaluation
export interface PolicyContext {
  subject: {
    user?: string;
    service?: string;
    team?: string;
    roles?: string[];
  };
  resource: {
    type: string;
    id: string;
    attributes: Record<string, any>;
  };
  action: string;
  environment: {
    time: Date;
    location?: string;
    network?: string;
  };
  metadata?: Record<string, any>;
}

export class PolicyEngine extends EventEmitter {
  private policies: Map<string, PolicyDefinition> = new Map();
  private opaUrl: string;
  private policyCache: Map<string, any> = new Map();
  private evaluationMetrics: Map<string, number> = new Map();

  constructor(opaUrl: string = 'http://localhost:8181') {
    super();
    this.opaUrl = opaUrl;
  }

  /**
   * Load policy from definition
   */
  async loadPolicy(definition: PolicyDefinition): Promise<void> {
    try {
      // Validate policy definition
      const validatedPolicy = PolicyDefinitionSchema.parse(definition);
      
      // Store policy
      this.policies.set(validatedPolicy.id, validatedPolicy);
      
      // Upload policy to OPA
      await this.uploadPolicyToOPA(validatedPolicy);
      
      // Clear cache for this policy
      this.policyCache.delete(validatedPolicy.id);
      
      this.emit('policyLoaded', validatedPolicy);
      
    } catch (error) {
      this.emit('policyLoadError', { policyId: definition.id, error });
      throw new Error(`Failed to load policy ${definition.id}: ${error.message}`);
    }
  }

  /**
   * Load policies from YAML file
   */
  async loadPoliciesFromFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');
      const policiesData = yaml.load(content) as any;
      
      if (Array.isArray(policiesData.policies)) {
        for (const policyData of policiesData.policies) {
          await this.loadPolicy(policyData);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load policies from file: ${error.message}`);
    }
  }

  /**
   * Evaluate policy against context
   */
  async evaluatePolicy(
    policyId: string,
    context: PolicyContext
  ): Promise<PolicyEvaluationResult[]> {
    const startTime = Date.now();
    
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error(`Policy ${policyId} not found`);
      }

      // Check if policy applies to current scope
      if (!this.isPolicyApplicable(policy, context)) {
        return [];
      }

      // Evaluate using OPA
      const opaResult = await this.evaluateWithOPA(policyId, context);
      
      // Process results
      const results: PolicyEvaluationResult[] = [];
      
      for (const rule of policy.rules) {
        const ruleResult = opaResult[rule.id];
        if (ruleResult) {
          results.push({
            policyId,
            ruleName: rule.id,
            decision: ruleResult.decision,
            message: ruleResult.message || rule.message,
            remediation: rule.remediation,
            metadata: {
              severity: policy.metadata.severity,
              category: policy.metadata.category,
              timestamp: new Date(),
              evaluationTime: Date.now() - startTime
            },
            evidence: ruleResult.evidence
          });
        }
      }

      // Update metrics
      this.updateEvaluationMetrics(policyId, Date.now() - startTime);
      
      return results;
      
    } catch (error) {
      this.emit('evaluationError', { policyId, context, error });
      throw error;
    }
  }

  /**
   * Evaluate all applicable policies
   */
  async evaluateAllPolicies(context: PolicyContext): Promise<PolicyEvaluationResult[]> {
    const results: PolicyEvaluationResult[] = [];
    
    for (const [policyId] of this.policies) {
      try {
        const policyResults = await this.evaluatePolicy(policyId, context);
        results.push(...policyResults);
      } catch (error) {
        // Log error but continue with other policies
        console.error(`Failed to evaluate policy ${policyId}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Create policy bundle for OPA
   */
  async createPolicyBundle(): Promise<PolicyBundle> {
    const policies: Record<string, string> = {};
    const data: Record<string, any> = {};
    
    for (const [id, policy] of this.policies) {
      policies[`${id}.rego`] = policy.rego;
      data[id] = {
        metadata: policy.metadata,
        scope: policy.scope,
        enforcement: policy.enforcement
      };
    }
    
    return {
      manifest: {
        revision: Date.now().toString(),
        roots: ['governance']
      },
      data,
      policies
    };
  }

  /**
   * Update policy bundle in OPA
   */
  async updatePolicyBundle(): Promise<void> {
    try {
      const bundle = await this.createPolicyBundle();
      
      await axios.put(`${this.opaUrl}/v1/policies`, bundle, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      this.emit('bundleUpdated', bundle);
      
    } catch (error) {
      this.emit('bundleUpdateError', error);
      throw error;
    }
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): PolicyDefinition | undefined {
    return this.policies.get(policyId);
  }

  /**
   * List all policies
   */
  listPolicies(): PolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  /**
   * Remove policy
   */
  async removePolicy(policyId: string): Promise<void> {
    if (!this.policies.has(policyId)) {
      throw new Error(`Policy ${policyId} not found`);
    }
    
    // Remove from OPA
    await this.removePolicyFromOPA(policyId);
    
    // Remove from local storage
    this.policies.delete(policyId);
    this.policyCache.delete(policyId);
    
    this.emit('policyRemoved', policyId);
  }

  /**
   * Get evaluation metrics
   */
  getEvaluationMetrics(): Record<string, any> {
    return {
      totalPolicies: this.policies.size,
      averageEvaluationTime: this.calculateAverageEvaluationTime(),
      policiesByCategory: this.getPoliciesByCategory(),
      evaluationCounts: Object.fromEntries(this.evaluationMetrics)
    };
  }

  /**
   * Validate policy definition
   */
  validatePolicy(definition: any): { valid: boolean; errors: string[] } {
    try {
      PolicyDefinitionSchema.parse(definition);
      
      // Additional validation
      const errors: string[] = [];
      
      // Validate Rego syntax (basic check)
      if (!definition.rego || typeof definition.rego !== 'string') {
        errors.push('Invalid or missing Rego policy code');
      }
      
      // Validate rule conditions
      for (const rule of definition.rules || []) {
        if (!rule.condition || !rule.action || !rule.message) {
          errors.push(`Invalid rule ${rule.id}: missing required fields`);
        }
      }
      
      return { valid: errors.length === 0, errors };
      
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  // Private methods

  private async uploadPolicyToOPA(policy: PolicyDefinition): Promise<void> {
    try {
      await axios.put(
        `${this.opaUrl}/v1/policies/${policy.id}`,
        policy.rego,
        { headers: { 'Content-Type': 'text/plain' } }
      );
    } catch (error) {
      throw new Error(`Failed to upload policy to OPA: ${error.message}`);
    }
  }

  private async removePolicyFromOPA(policyId: string): Promise<void> {
    try {
      await axios.delete(`${this.opaUrl}/v1/policies/${policyId}`);
    } catch (error) {
      console.warn(`Failed to remove policy from OPA: ${error.message}`);
    }
  }

  private async evaluateWithOPA(
    policyId: string,
    context: PolicyContext
  ): Promise<Record<string, any>> {
    try {
      const response = await axios.post(
        `${this.opaUrl}/v1/data/governance/${policyId}`,
        { input: context },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      return response.data.result || {};
      
    } catch (error) {
      throw new Error(`OPA evaluation failed: ${error.message}`);
    }
  }

  private isPolicyApplicable(policy: PolicyDefinition, context: PolicyContext): boolean {
    const scope = policy.scope;
    
    // Check organization scope
    if (scope.organization && scope.organization.length > 0) {
      if (!context.subject.service || !scope.organization.includes(context.subject.service)) {
        return false;
      }
    }
    
    // Check team scope
    if (scope.team && scope.team.length > 0) {
      if (!context.subject.team || !scope.team.includes(context.subject.team)) {
        return false;
      }
    }
    
    // Check service scope
    if (scope.service && scope.service.length > 0) {
      if (!context.resource.id || !scope.service.includes(context.resource.id)) {
        return false;
      }
    }
    
    // Check environment scope
    if (scope.environment && scope.environment.length > 0) {
      const environment = context.metadata?.environment;
      if (!environment || !scope.environment.includes(environment)) {
        return false;
      }
    }
    
    return true;
  }

  private updateEvaluationMetrics(policyId: string, evaluationTime: number): void {
    const currentCount = this.evaluationMetrics.get(policyId) || 0;
    this.evaluationMetrics.set(policyId, currentCount + 1);
    
    // Store evaluation time for average calculation
    const timeKey = `${policyId}_time`;
    const currentTime = this.evaluationMetrics.get(timeKey) || 0;
    this.evaluationMetrics.set(timeKey, currentTime + evaluationTime);
  }

  private calculateAverageEvaluationTime(): number {
    let totalTime = 0;
    let totalCount = 0;
    
    for (const [key, value] of this.evaluationMetrics) {
      if (key.endsWith('_time')) {
        totalTime += value;
      } else {
        totalCount += value;
      }
    }
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  private getPoliciesByCategory(): Record<string, number> {
    const categories: Record<string, number> = {};
    
    for (const policy of this.policies.values()) {
      const category = policy.metadata.category;
      categories[category] = (categories[category] || 0) + 1;
    }
    
    return categories;
  }
}

/**
 * Policy DSL Builder for creating policies programmatically
 */
export class PolicyBuilder {
  private policy: Partial<PolicyDefinition> = {
    rules: [],
    scope: {},
    enforcement: {
      level: 'warning',
      bypassable: false
    }
  };

  static create(id: string, name: string): PolicyBuilder {
    const builder = new PolicyBuilder();
    builder.policy.id = id;
    builder.policy.metadata = {
      name,
      description: '',
      category: 'security',
      severity: 'medium',
      owner: '',
      created: new Date(),
      modified: new Date()
    };
    return builder;
  }

  description(desc: string): PolicyBuilder {
    if (this.policy.metadata) {
      this.policy.metadata.description = desc;
    }
    return this;
  }

  category(cat: PolicyDefinition['metadata']['category']): PolicyBuilder {
    if (this.policy.metadata) {
      this.policy.metadata.category = cat;
    }
    return this;
  }

  severity(sev: PolicyDefinition['metadata']['severity']): PolicyBuilder {
    if (this.policy.metadata) {
      this.policy.metadata.severity = sev;
    }
    return this;
  }

  owner(owner: string): PolicyBuilder {
    if (this.policy.metadata) {
      this.policy.metadata.owner = owner;
    }
    return this;
  }

  addRule(rule: {
    id: string;
    condition: string;
    action: 'allow' | 'deny' | 'warn' | 'require-approval';
    message: string;
    remediation?: string;
  }): PolicyBuilder {
    this.policy.rules = this.policy.rules || [];
    this.policy.rules.push(rule);
    return this;
  }

  scopeToOrganization(orgs: string[]): PolicyBuilder {
    this.policy.scope = this.policy.scope || {};
    this.policy.scope.organization = orgs;
    return this;
  }

  scopeToTeam(teams: string[]): PolicyBuilder {
    this.policy.scope = this.policy.scope || {};
    this.policy.scope.team = teams;
    return this;
  }

  scopeToService(services: string[]): PolicyBuilder {
    this.policy.scope = this.policy.scope || {};
    this.policy.scope.service = services;
    return this;
  }

  enforcementLevel(level: 'strict' | 'advisory' | 'warning'): PolicyBuilder {
    this.policy.enforcement = this.policy.enforcement || { level: 'warning', bypassable: false };
    this.policy.enforcement.level = level;
    return this;
  }

  bypassable(bypassable: boolean = true): PolicyBuilder {
    this.policy.enforcement = this.policy.enforcement || { level: 'warning', bypassable: false };
    this.policy.enforcement.bypassable = bypassable;
    return this;
  }

  rego(regoCode: string): PolicyBuilder {
    this.policy.rego = regoCode;
    return this;
  }

  build(): PolicyDefinition {
    if (!this.policy.version) {
      this.policy.version = '1.0.0';
    }
    
    return PolicyDefinitionSchema.parse(this.policy);
  }
}