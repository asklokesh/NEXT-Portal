/**
 * Policy Engine
 * Advanced policy evaluation and rule management
 */

import {
  PermissionPolicy,
  PermissionRule,
  PermissionCondition,
  ResourceType,
  PermissionAction,
  UserWithPermissions,
  PermissionContext
} from './types';
import { prisma } from '@/lib/db/client';
import { v4 as uuidv4 } from 'uuid';

export class PolicyEngine {
  private policies: Map<string, PermissionPolicy>;
  private compiledRules: Map<string, CompiledRule>;

  constructor() {
    this.policies = new Map();
    this.compiledRules = new Map();
    this.loadDefaultPolicies();
  }

  /**
   * Load default policies
   */
  private async loadDefaultPolicies(): Promise<void> {
    // Data Protection Policy
    this.addPolicy({
      id: 'policy-data-protection',
      name: 'Data Protection Policy',
      description: 'Protect sensitive data access',
      version: '1.0.0',
      isActive: true,
      rules: [
        {
          id: 'rule-pii-access',
          name: 'PII Access Control',
          description: 'Restrict access to personally identifiable information',
          resource: ResourceType.USER,
          action: PermissionAction.READ,
          conditions: [
            {
              field: 'user.attributes.clearanceLevel',
              operator: 'gte',
              value: 3
            }
          ],
          effect: 'allow',
          priority: 100
        },
        {
          id: 'rule-audit-protection',
          name: 'Audit Log Protection',
          description: 'Only admins can delete audit logs',
          resource: ResourceType.AUDIT,
          action: PermissionAction.DELETE,
          conditions: [
            {
              field: 'user.roles',
              operator: 'contains',
              value: 'admin'
            }
          ],
          effect: 'allow',
          priority: 200
        }
      ],
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Resource Ownership Policy
    this.addPolicy({
      id: 'policy-ownership',
      name: 'Resource Ownership Policy',
      description: 'Owners have full control over their resources',
      version: '1.0.0',
      isActive: true,
      rules: [
        {
          id: 'rule-owner-control',
          name: 'Owner Full Control',
          description: 'Resource owners can perform any action',
          resource: ResourceType.ENTITY,
          action: PermissionAction.MANAGE,
          conditions: [
            {
              field: 'context.entityOwner',
              operator: 'eq',
              value: '${user.id}' // Dynamic value
            }
          ],
          effect: 'allow',
          priority: 50
        }
      ],
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Time-based Access Policy
    this.addPolicy({
      id: 'policy-time-based',
      name: 'Time-based Access Policy',
      description: 'Restrict access during off-hours',
      version: '1.0.0',
      isActive: true,
      rules: [
        {
          id: 'rule-business-hours',
          name: 'Business Hours Only',
          description: 'Critical operations only during business hours',
          resource: ResourceType.SETTINGS,
          action: PermissionAction.UPDATE,
          conditions: [
            {
              field: 'context.requestMetadata.hour',
              operator: 'gte',
              value: 9
            },
            {
              field: 'context.requestMetadata.hour',
              operator: 'lte',
              value: 17
            }
          ],
          effect: 'allow',
          priority: 150
        }
      ],
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Compliance Policy
    this.addPolicy({
      id: 'policy-compliance',
      name: 'Compliance Policy',
      description: 'Enforce regulatory compliance',
      version: '1.0.0',
      isActive: true,
      rules: [
        {
          id: 'rule-gdpr-export',
          name: 'GDPR Export Control',
          description: 'Control data export for GDPR compliance',
          resource: ResourceType.USER,
          action: PermissionAction.EXPORT,
          conditions: [
            {
              field: 'user.attributes.department',
              operator: 'in',
              value: ['legal', 'compliance', 'security']
            }
          ],
          effect: 'allow',
          priority: 300
        },
        {
          id: 'rule-sox-approval',
          name: 'SOX Approval Required',
          description: 'Financial changes require approval',
          resource: ResourceType.COST,
          action: PermissionAction.UPDATE,
          conditions: [
            {
              field: 'context.requestMetadata.approved',
              operator: 'eq',
              value: true
            }
          ],
          effect: 'allow',
          priority: 400
        }
      ],
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Add or update policy
   */
  async addPolicy(policy: PermissionPolicy): Promise<void> {
    this.policies.set(policy.id, policy);
    
    // Compile rules for faster evaluation
    for (const rule of policy.rules) {
      this.compileRule(rule);
    }

    // Persist to database
    await this.savePolicy(policy);
  }

  /**
   * Remove policy
   */
  async removePolicy(policyId: string): Promise<void> {
    const policy = this.policies.get(policyId);
    if (policy) {
      // Remove compiled rules
      for (const rule of policy.rules) {
        this.compiledRules.delete(rule.id);
      }
      this.policies.delete(policyId);

      // Remove from database
      await prisma.$executeRaw`
        DELETE FROM permission_policies WHERE id = ${policyId}
      `;
    }
  }

  /**
   * Evaluate policies for a request
   */
  async evaluatePolicies(
    user: UserWithPermissions,
    resource: ResourceType,
    action: PermissionAction,
    context?: PermissionContext
  ): Promise<{
    allowed: boolean;
    matchedRules: PermissionRule[];
    deniedByRule?: PermissionRule;
    allowedByRule?: PermissionRule;
  }> {
    const matchedRules: PermissionRule[] = [];
    let deniedByRule: PermissionRule | undefined;
    let allowedByRule: PermissionRule | undefined;

    // Get all active policies
    const activePolicies = Array.from(this.policies.values())
      .filter(p => p.isActive);

    // Collect all rules and sort by priority
    const allRules: PermissionRule[] = [];
    for (const policy of activePolicies) {
      allRules.push(...policy.rules);
    }
    allRules.sort((a, b) => b.priority - a.priority);

    // Evaluate rules in priority order
    for (const rule of allRules) {
      if (rule.resource !== resource || rule.action !== action) {
        continue;
      }

      const matches = await this.evaluateRuleConditions(
        rule,
        user,
        context
      );

      if (matches) {
        matchedRules.push(rule);

        if (rule.effect === 'deny') {
          deniedByRule = rule;
          return {
            allowed: false,
            matchedRules,
            deniedByRule
          };
        } else if (rule.effect === 'allow' && !allowedByRule) {
          allowedByRule = rule;
        }
      }
    }

    return {
      allowed: !!allowedByRule,
      matchedRules,
      deniedByRule,
      allowedByRule
    };
  }

  /**
   * Evaluate rule conditions
   */
  private async evaluateRuleConditions(
    rule: PermissionRule,
    user: UserWithPermissions,
    context?: PermissionContext
  ): Promise<boolean> {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true;
    }

    const compiled = this.compiledRules.get(rule.id);
    if (compiled) {
      return compiled.evaluate(user, context);
    }

    // Fallback to regular evaluation
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, user, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    condition: PermissionCondition,
    user: UserWithPermissions,
    context?: PermissionContext
  ): boolean {
    let value = this.resolveValue(condition.field, user, context);
    let compareValue = condition.value;

    // Handle dynamic values
    if (typeof compareValue === 'string' && compareValue.startsWith('${')) {
      compareValue = this.resolveValue(
        compareValue.slice(2, -1),
        user,
        context
      );
    }

    switch (condition.operator) {
      case 'eq':
        return value === compareValue;
      case 'neq':
        return value !== compareValue;
      case 'gt':
        return value > compareValue;
      case 'lt':
        return value < compareValue;
      case 'gte':
        return value >= compareValue;
      case 'lte':
        return value <= compareValue;
      case 'contains':
        if (Array.isArray(value)) {
          return value.includes(compareValue);
        }
        return String(value).includes(String(compareValue));
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(value);
      case 'nin':
        return Array.isArray(compareValue) && !compareValue.includes(value);
      default:
        return false;
    }
  }

  /**
   * Resolve value from path
   */
  private resolveValue(
    path: string,
    user: UserWithPermissions,
    context?: PermissionContext
  ): any {
    const parts = path.split('.');
    let current: any = { user, context };

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Compile rule for faster evaluation
   */
  private compileRule(rule: PermissionRule): void {
    const compiled = new CompiledRule(rule);
    this.compiledRules.set(rule.id, compiled);
  }

  /**
   * Save policy to database
   */
  private async savePolicy(policy: PermissionPolicy): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO permission_policies (
          id, name, description, rules, version, is_active,
          created_by, created_at, updated_at
        ) VALUES (
          ${policy.id}, ${policy.name}, ${policy.description},
          ${JSON.stringify(policy.rules)}, ${policy.version}, ${policy.isActive},
          ${policy.createdBy}, ${policy.createdAt}, ${policy.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          rules = EXCLUDED.rules,
          version = EXCLUDED.version,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  }

  /**
   * Load policies from database
   */
  async loadPolicies(): Promise<void> {
    try {
      const policies = await prisma.$queryRaw`
        SELECT * FROM permission_policies WHERE is_active = true
      `;

      for (const dbPolicy of policies as any[]) {
        const policy: PermissionPolicy = {
          id: dbPolicy.id,
          name: dbPolicy.name,
          description: dbPolicy.description,
          rules: JSON.parse(dbPolicy.rules),
          version: dbPolicy.version,
          isActive: dbPolicy.is_active,
          createdBy: dbPolicy.created_by,
          createdAt: dbPolicy.created_at,
          updatedAt: dbPolicy.updated_at
        };

        this.policies.set(policy.id, policy);
        for (const rule of policy.rules) {
          this.compileRule(rule);
        }
      }
    } catch (error) {
      console.error('Failed to load policies:', error);
    }
  }

  /**
   * Get all policies
   */
  getAllPolicies(): PermissionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): PermissionPolicy | undefined {
    return this.policies.get(policyId);
  }
}

/**
 * Compiled rule for faster evaluation
 */
class CompiledRule {
  private rule: PermissionRule;
  private evaluator: Function;

  constructor(rule: PermissionRule) {
    this.rule = rule;
    this.evaluator = this.compile();
  }

  private compile(): Function {
    // Create optimized evaluation function
    const conditions = this.rule.conditions || [];
    
    return (user: UserWithPermissions, context?: PermissionContext) => {
      for (const condition of conditions) {
        // Optimized condition evaluation
        if (!this.evaluateCondition(condition, user, context)) {
          return false;
        }
      }
      return true;
    };
  }

  private evaluateCondition(
    condition: PermissionCondition,
    user: UserWithPermissions,
    context?: PermissionContext
  ): boolean {
    // Implement fast path evaluation
    const value = this.getValue(condition.field, user, context);
    
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'neq': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'gte': return value >= condition.value;
      case 'lte': return value <= condition.value;
      case 'contains':
        if (Array.isArray(value)) return value.includes(condition.value);
        return String(value).includes(String(condition.value));
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin': return Array.isArray(condition.value) && !condition.value.includes(value);
      default: return false;
    }
  }

  private getValue(
    path: string,
    user: UserWithPermissions,
    context?: PermissionContext
  ): any {
    const parts = path.split('.');
    let current: any = { user, context };
    
    for (const part of parts) {
      if (!current) return undefined;
      current = current[part];
    }
    
    return current;
  }

  evaluate(user: UserWithPermissions, context?: PermissionContext): boolean {
    return this.evaluator(user, context);
  }
}