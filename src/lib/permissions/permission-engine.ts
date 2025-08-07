/**
 * Permission Engine
 * Core engine for evaluating permissions and access control
 */

import {
  Permission,
  PermissionAction,
  PermissionCheckRequest,
  PermissionCondition,
  PermissionContext,
  PermissionDecision,
  PermissionEvaluationResult,
  PermissionRule,
  ResourceType,
  Role,
  UserWithPermissions
} from './types';
import { PermissionCache } from './permission-cache';
import { AuditLogger } from './audit-logger';
import { prisma } from '@/lib/db/client';

export class PermissionEngine {
  private cache: PermissionCache;
  private auditLogger: AuditLogger;
  private evaluationMetrics: Map<string, number>;

  constructor() {
    this.cache = new PermissionCache();
    this.auditLogger = new AuditLogger();
    this.evaluationMetrics = new Map();
  }

  /**
   * Check if user has permission for a specific action
   */
  async checkPermission(
    request: PermissionCheckRequest
  ): Promise<PermissionDecision> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.recordMetric('cache_hit', 1);
        return cached;
      }

      // Load user with permissions
      const user = await this.loadUserWithPermissions(request.userId);
      if (!user) {
        return this.deny('User not found');
      }

      // Evaluate permissions
      const result = await this.evaluatePermissions(
        user,
        request.resource,
        request.action,
        request.context
      );

      // Cache the decision
      if (result.cacheable) {
        await this.cache.set(cacheKey, result.decision, result.ttl);
      }

      // Audit log
      await this.auditLogger.log({
        userId: request.userId,
        action: request.action,
        resource: request.resource,
        resourceId: request.resourceId,
        decision: result.decision,
        context: request.context
      });

      this.recordMetric('evaluation_time', Date.now() - startTime);
      return result.decision;
    } catch (error) {
      console.error('Permission check failed:', error);
      this.recordMetric('evaluation_error', 1);
      return this.deny('Permission evaluation failed');
    }
  }

  /**
   * Evaluate permissions for a user
   */
  private async evaluatePermissions(
    user: UserWithPermissions,
    resource: ResourceType,
    action: PermissionAction,
    context?: PermissionContext
  ): Promise<PermissionEvaluationResult> {
    const evaluatedRules: PermissionRule[] = [];
    let decision: PermissionDecision = { allowed: false };
    let cacheable = true;

    // Check explicit deny rules first
    const denyRules = await this.findApplicableRules(
      user,
      resource,
      action,
      'deny'
    );

    for (const rule of denyRules) {
      if (await this.evaluateRule(rule, user, context)) {
        evaluatedRules.push(rule);
        decision = {
          allowed: false,
          reason: `Denied by rule: ${rule.name}`,
          deniedBy: rule
        };
        return {
          decision,
          evaluatedRules,
          userRoles: user.roles,
          effectivePermissions: user.permissions,
          cacheable,
          ttl: 300 // 5 minutes
        };
      }
    }

    // Check allow rules
    const allowRules = await this.findApplicableRules(
      user,
      resource,
      action,
      'allow'
    );

    for (const rule of allowRules) {
      if (await this.evaluateRule(rule, user, context)) {
        evaluatedRules.push(rule);
        decision = {
          allowed: true,
          reason: `Allowed by rule: ${rule.name}`,
          allowedBy: rule
        };
        break;
      }
    }

    // Check role-based permissions
    if (!decision.allowed) {
      for (const role of user.roles) {
        const hasPermission = this.roleHasPermission(
          role,
          resource,
          action,
          context
        );
        if (hasPermission) {
          decision = {
            allowed: true,
            reason: `Allowed by role: ${role.name}`
          };
          break;
        }
      }
    }

    // Check direct user permissions
    if (!decision.allowed) {
      const hasDirectPermission = this.userHasDirectPermission(
        user,
        resource,
        action,
        context
      );
      if (hasDirectPermission) {
        decision = {
          allowed: true,
          reason: 'Allowed by direct user permission'
        };
      }
    }

    return {
      decision,
      evaluatedRules,
      userRoles: user.roles,
      effectivePermissions: user.permissions,
      cacheable,
      ttl: decision.allowed ? 600 : 300 // Cache allow decisions longer
    };
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(
    rule: PermissionRule,
    user: UserWithPermissions,
    context?: PermissionContext
  ): Promise<boolean> {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true;
    }

    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, user, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a condition (ABAC)
   */
  private async evaluateCondition(
    condition: PermissionCondition,
    user: UserWithPermissions,
    context?: PermissionContext
  ): Promise<boolean> {
    const value = this.getConditionValue(condition.field, user, context);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return value > condition.value;
      case 'lt':
        return value < condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lte':
        return value <= condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return false;
    }
  }

  /**
   * Get value for condition evaluation
   */
  private getConditionValue(
    field: string,
    user: UserWithPermissions,
    context?: PermissionContext
  ): any {
    const parts = field.split('.');
    let value: any = { user, context };

    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    return value;
  }

  /**
   * Check if role has permission
   */
  private roleHasPermission(
    role: Role,
    resource: ResourceType,
    action: PermissionAction,
    context?: PermissionContext
  ): boolean {
    return role.permissions.some(permission => 
      permission.resource === resource &&
      permission.action === action &&
      this.scopeMatches(permission.scope, context)
    );
  }

  /**
   * Check if user has direct permission
   */
  private userHasDirectPermission(
    user: UserWithPermissions,
    resource: ResourceType,
    action: PermissionAction,
    context?: PermissionContext
  ): boolean {
    return user.permissions.some(permission =>
      permission.resource === resource &&
      permission.action === action &&
      this.scopeMatches(permission.scope, context)
    );
  }

  /**
   * Check if scope matches context
   */
  private scopeMatches(
    scope: Permission['scope'],
    context?: PermissionContext
  ): boolean {
    if (!scope || scope.type === 'global') {
      return true;
    }

    if (!context) {
      return false;
    }

    switch (scope.type) {
      case 'organization':
        return scope.entityId === context.organizationId;
      case 'team':
        return scope.entityId === context.teamId;
      case 'project':
        return scope.entityId === context.projectId;
      case 'self':
        return true; // Handled elsewhere
      default:
        return false;
    }
  }

  /**
   * Find applicable rules
   */
  private async findApplicableRules(
    user: UserWithPermissions,
    resource: ResourceType,
    action: PermissionAction,
    effect: 'allow' | 'deny'
  ): Promise<PermissionRule[]> {
    // This would typically query from database
    // For now, returning mock data
    return [];
  }

  /**
   * Load user with permissions
   */
  private async loadUserWithPermissions(
    userId: string
  ): Promise<UserWithPermissions | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              permissions: true
            }
          },
          permissions: true
        }
      });

      return user as any; // Type casting for simplicity
    } catch (error) {
      console.error('Failed to load user:', error);
      return null;
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: PermissionCheckRequest): string {
    return `perm:${request.userId}:${request.resource}:${request.action}:${request.resourceId || 'global'}`;
  }

  /**
   * Create deny decision
   */
  private deny(reason: string): PermissionDecision {
    return {
      allowed: false,
      reason
    };
  }

  /**
   * Record metric
   */
  private recordMetric(name: string, value: number): void {
    const current = this.evaluationMetrics.get(name) || 0;
    this.evaluationMetrics.set(name, current + value);
  }

  /**
   * Get metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.evaluationMetrics);
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}