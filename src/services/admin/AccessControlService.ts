/**
 * Enterprise Access Control Service
 * Implements RBAC and ABAC with fine-grained permissions and inheritance
 */

import { prisma } from '@/lib/db/client';
import { UserRole, TeamRole } from '@prisma/client';
import { EventEmitter } from 'events';
import { CacheService } from '@/lib/cache/CacheService';
import { AuditService } from './AuditService';

export interface Permission {
  id: string;
  resource: string;
  action: string;
  scope?: PermissionScope;
  conditions?: PermissionCondition[];
  effect: 'allow' | 'deny';
  priority?: number;
}

export interface PermissionScope {
  type: 'global' | 'organization' | 'team' | 'project' | 'self';
  entityId?: string;
}

export interface PermissionCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'nin' | 'regex';
  value: any;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  parent?: string; // For role inheritance
  isSystem?: boolean;
  metadata?: Record<string, any>;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  resource: string;
  actions: string[];
  conditions: PermissionCondition[];
  effect: 'allow' | 'deny';
  priority: number;
  enabled: boolean;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
  context?: AccessContext;
}

export interface AccessContext {
  organizationId?: string;
  teamId?: string;
  projectId?: string;
  environment?: string;
  requestTime?: Date;
  ipAddress?: string;
  userAgent?: string;
  attributes?: Record<string, any>;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
  evaluatedPolicies?: string[];
  permissions?: Permission[];
  attributes?: Record<string, any>;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  scope?: PermissionScope;
  expiresAt?: Date;
  assignedBy: string;
}

export class AccessControlService extends EventEmitter {
  private cacheService: CacheService;
  private auditService: AuditService;
  private systemRoles: Map<string, Role>;
  private policyRules: Map<string, PolicyRule>;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor() {
    super();
    this.cacheService = new CacheService();
    this.auditService = new AuditService();
    this.systemRoles = new Map();
    this.policyRules = new Map();
    this.initializeSystemRoles();
    this.loadPolicyRules();
  }

  /**
   * Check access permission for a user
   */
  async checkAccess(request: AccessRequest): Promise<AccessDecision> {
    try {
      const startTime = Date.now();
      
      // Check cache first
      const cacheKey = this.buildCacheKey(request);
      const cached = await this.cacheService.get<AccessDecision>(cacheKey);
      if (cached) {
        return cached;
      }

      // Load user with permissions
      const userPermissions = await this.loadUserPermissions(request.userId);
      
      // Evaluate RBAC
      const rbacDecision = await this.evaluateRBAC(
        userPermissions,
        request.resource,
        request.action,
        request.context
      );

      // If RBAC denies, check ABAC for override
      let finalDecision = rbacDecision;
      if (!rbacDecision.allowed) {
        const abacDecision = await this.evaluateABAC(
          request.userId,
          request.resource,
          request.action,
          request.context
        );
        
        if (abacDecision.allowed) {
          finalDecision = abacDecision;
        }
      }

      // Check explicit deny policies
      const denyDecision = await this.checkDenyPolicies(
        request.userId,
        request.resource,
        request.action,
        request.context
      );

      if (denyDecision) {
        finalDecision = denyDecision;
      }

      // Cache the decision
      await this.cacheService.set(cacheKey, finalDecision, this.CACHE_TTL);

      // Audit log
      await this.auditService.log({
        action: 'ACCESS_CHECK',
        userId: request.userId,
        targetId: request.resourceId,
        details: {
          resource: request.resource,
          action: request.action,
          decision: finalDecision.allowed,
          duration: Date.now() - startTime
        }
      });

      return finalDecision;
    } catch (error) {
      console.error('Access check failed:', error);
      return {
        allowed: false,
        reason: 'Access evaluation failed'
      };
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(assignment: RoleAssignment): Promise<void> {
    try {
      // Validate role exists
      const role = await this.getRole(assignment.roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Check if assignment already exists
      const existing = await prisma.permission.findFirst({
        where: {
          userId: assignment.userId,
          roleId: assignment.roleId,
          scope: assignment.scope as any
        }
      });

      if (existing) {
        throw new Error('Role already assigned to user');
      }

      // Create role assignment
      await prisma.$transaction(async (tx) => {
        // Store role assignment
        await tx.permission.create({
          data: {
            userId: assignment.userId,
            roleId: assignment.roleId,
            scope: assignment.scope as any,
            expiresAt: assignment.expiresAt,
            assignedBy: assignment.assignedBy,
            createdAt: new Date()
          }
        });

        // Audit log
        await this.auditService.log({
          action: 'ROLE_ASSIGN',
          userId: assignment.assignedBy,
          targetId: assignment.userId,
          details: {
            roleId: assignment.roleId,
            scope: assignment.scope,
            expiresAt: assignment.expiresAt
          }
        });
      });

      // Clear cache
      await this.clearUserCache(assignment.userId);

      // Emit event
      this.emit('role:assigned', assignment);
    } catch (error) {
      console.error('Failed to assign role:', error);
      throw error;
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRole(
    userId: string,
    roleId: string,
    revokedBy: string
  ): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Remove role assignment
        await tx.permission.deleteMany({
          where: {
            userId,
            roleId
          }
        });

        // Audit log
        await this.auditService.log({
          action: 'ROLE_REVOKE',
          userId: revokedBy,
          targetId: userId,
          details: { roleId }
        });
      });

      // Clear cache
      await this.clearUserCache(userId);

      // Emit event
      this.emit('role:revoked', { userId, roleId });
    } catch (error) {
      console.error('Failed to revoke role:', error);
      throw error;
    }
  }

  /**
   * Create custom role
   */
  async createRole(role: Role, createdBy: string): Promise<Role> {
    try {
      // Validate role
      if (await this.roleExists(role.name)) {
        throw new Error('Role with this name already exists');
      }

      // Store role
      const createdRole = await prisma.$transaction(async (tx) => {
        // Create role in database
        const dbRole = await tx.role.create({
          data: {
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions as any,
            parent: role.parent,
            isSystem: false,
            metadata: role.metadata as any,
            createdAt: new Date()
          }
        });

        // Audit log
        await this.auditService.log({
          action: 'ROLE_CREATE',
          userId: createdBy,
          targetId: dbRole.id,
          details: {
            name: role.name,
            permissions: role.permissions.length
          }
        });

        return dbRole;
      });

      // Update cache
      this.systemRoles.set(role.id, role);

      // Emit event
      this.emit('role:created', createdRole);

      return role;
    } catch (error) {
      console.error('Failed to create role:', error);
      throw error;
    }
  }

  /**
   * Update role permissions
   */
  async updateRolePermissions(
    roleId: string,
    permissions: Permission[],
    updatedBy: string
  ): Promise<void> {
    try {
      const role = await this.getRole(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.isSystem) {
        throw new Error('Cannot modify system role');
      }

      await prisma.$transaction(async (tx) => {
        // Update role permissions
        await tx.role.update({
          where: { id: roleId },
          data: {
            permissions: permissions as any,
            updatedAt: new Date()
          }
        });

        // Audit log
        await this.auditService.log({
          action: 'ROLE_UPDATE_PERMISSIONS',
          userId: updatedBy,
          targetId: roleId,
          details: {
            previousPermissions: role.permissions.length,
            newPermissions: permissions.length
          }
        });
      });

      // Update cache
      role.permissions = permissions;
      this.systemRoles.set(roleId, role);

      // Clear cache for all users with this role
      await this.clearRoleCache(roleId);

      // Emit event
      this.emit('role:permissions-updated', { roleId, permissions });
    } catch (error) {
      console.error('Failed to update role permissions:', error);
      throw error;
    }
  }

  /**
   * Create policy rule for ABAC
   */
  async createPolicyRule(rule: PolicyRule, createdBy: string): Promise<PolicyRule> {
    try {
      // Validate rule
      if (this.policyRules.has(rule.id)) {
        throw new Error('Policy rule already exists');
      }

      // Store policy rule
      await prisma.$transaction(async (tx) => {
        await tx.policyRule.create({
          data: {
            id: rule.id,
            name: rule.name,
            description: rule.description,
            resource: rule.resource,
            actions: rule.actions,
            conditions: rule.conditions as any,
            effect: rule.effect,
            priority: rule.priority,
            enabled: rule.enabled,
            createdBy,
            createdAt: new Date()
          }
        });

        // Audit log
        await this.auditService.log({
          action: 'POLICY_CREATE',
          userId: createdBy,
          targetId: rule.id,
          details: {
            name: rule.name,
            resource: rule.resource,
            effect: rule.effect
          }
        });
      });

      // Update cache
      this.policyRules.set(rule.id, rule);

      // Emit event
      this.emit('policy:created', rule);

      return rule;
    } catch (error) {
      console.error('Failed to create policy rule:', error);
      throw error;
    }
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const cacheKey = `permissions:${userId}`;
      
      // Check cache
      const cached = await this.cacheService.get<Permission[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Load user with roles and teams
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMemberships: {
            include: {
              team: {
                include: {
                  permissions: true
                }
              }
            }
          }
        }
      });

      if (!user) {
        return [];
      }

      const permissions: Permission[] = [];

      // Get role-based permissions
      const rolePermissions = await this.getRolePermissions(user.role);
      permissions.push(...rolePermissions);

      // Get team-based permissions
      for (const membership of user.teamMemberships) {
        const teamPermissions = await this.getTeamPermissions(
          membership.teamId,
          membership.role
        );
        permissions.push(...teamPermissions);
      }

      // Get direct user permissions
      const directPermissions = await prisma.permission.findMany({
        where: { userId }
      });
      permissions.push(...directPermissions.map(p => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        scope: p.scope as any,
        effect: 'allow' as const
      })));

      // Merge and deduplicate permissions
      const effectivePermissions = this.mergePermissions(permissions);

      // Cache result
      await this.cacheService.set(cacheKey, effectivePermissions, this.CACHE_TTL);

      return effectivePermissions;
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return [];
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    scope?: PermissionScope
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    return permissions.some(p => 
      p.resource === resource &&
      p.action === action &&
      ((!scope && !p.scope) || this.scopeMatches(p.scope, scope))
    );
  }

  /**
   * Get permission hierarchy for visualization
   */
  async getPermissionHierarchy(userId: string): Promise<{
    user: { id: string; role: UserRole };
    roles: Role[];
    teams: Array<{ id: string; name: string; role: TeamRole }>;
    permissions: {
      direct: Permission[];
      inherited: Permission[];
      effective: Permission[];
    };
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMemberships: {
          include: {
            team: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const directPermissions = await prisma.permission.findMany({
      where: { userId }
    }).then(perms => perms.map(p => ({
      id: p.id,
      resource: p.resource,
      action: p.action,
      scope: p.scope as any,
      effect: 'allow' as const
    })));

    const rolePermissions = await this.getRolePermissions(user.role);
    const effectivePermissions = await this.getUserPermissions(userId);

    return {
      user: { id: user.id, role: user.role },
      roles: [this.systemRoles.get(user.role)!].filter(Boolean),
      teams: user.teamMemberships.map(m => ({
        id: m.team.id,
        name: m.team.name,
        role: m.role
      })),
      permissions: {
        direct: directPermissions,
        inherited: rolePermissions,
        effective: effectivePermissions
      }
    };
  }

  /**
   * Initialize system roles
   */
  private initializeSystemRoles(): void {
    // Admin role
    this.systemRoles.set('ADMIN', {
      id: 'ADMIN',
      name: 'Administrator',
      description: 'Full system access',
      permissions: [
        { id: '1', resource: '*', action: '*', effect: 'allow' }
      ],
      isSystem: true
    });

    // Platform Engineer role
    this.systemRoles.set('PLATFORM_ENGINEER', {
      id: 'PLATFORM_ENGINEER',
      name: 'Platform Engineer',
      description: 'Platform management access',
      permissions: [
        { id: '2', resource: 'platform', action: '*', effect: 'allow' },
        { id: '3', resource: 'service', action: '*', effect: 'allow' },
        { id: '4', resource: 'template', action: '*', effect: 'allow' },
        { id: '5', resource: 'plugin', action: '*', effect: 'allow' }
      ],
      isSystem: true
    });

    // Developer role
    this.systemRoles.set('DEVELOPER', {
      id: 'DEVELOPER',
      name: 'Developer',
      description: 'Standard developer access',
      permissions: [
        { id: '6', resource: 'service', action: 'read', effect: 'allow' },
        { id: '7', resource: 'service', action: 'create', effect: 'allow' },
        { id: '8', resource: 'service', action: 'update', scope: { type: 'self' }, effect: 'allow' },
        { id: '9', resource: 'template', action: 'read', effect: 'allow' },
        { id: '10', resource: 'template', action: 'use', effect: 'allow' }
      ],
      isSystem: true
    });

    // Viewer role
    this.systemRoles.set('VIEWER', {
      id: 'VIEWER',
      name: 'Viewer',
      description: 'Read-only access',
      permissions: [
        { id: '11', resource: '*', action: 'read', effect: 'allow' }
      ],
      isSystem: true
    });
  }

  /**
   * Load policy rules from database
   */
  private async loadPolicyRules(): Promise<void> {
    try {
      const rules = await prisma.policyRule.findMany({
        where: { enabled: true }
      });

      for (const rule of rules) {
        this.policyRules.set(rule.id, {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          resource: rule.resource,
          actions: rule.actions,
          conditions: rule.conditions as any,
          effect: rule.effect as 'allow' | 'deny',
          priority: rule.priority,
          enabled: rule.enabled
        });
      }
    } catch (error) {
      console.error('Failed to load policy rules:', error);
    }
  }

  /**
   * Evaluate RBAC permissions
   */
  private async evaluateRBAC(
    permissions: Permission[],
    resource: string,
    action: string,
    context?: AccessContext
  ): Promise<AccessDecision> {
    // Check for matching permissions
    const matching = permissions.filter(p => 
      this.resourceMatches(p.resource, resource) &&
      this.actionMatches(p.action, action) &&
      this.scopeMatches(p.scope, context)
    );

    // Check for explicit deny
    const deny = matching.find(p => p.effect === 'deny');
    if (deny) {
      return {
        allowed: false,
        reason: 'Explicitly denied by permission',
        permissions: [deny]
      };
    }

    // Check for allow
    const allow = matching.find(p => p.effect === 'allow');
    if (allow) {
      return {
        allowed: true,
        reason: 'Allowed by RBAC permission',
        permissions: [allow]
      };
    }

    return {
      allowed: false,
      reason: 'No matching RBAC permissions'
    };
  }

  /**
   * Evaluate ABAC policies
   */
  private async evaluateABAC(
    userId: string,
    resource: string,
    action: string,
    context?: AccessContext
  ): Promise<AccessDecision> {
    const applicableRules = Array.from(this.policyRules.values())
      .filter(rule => 
        rule.enabled &&
        this.resourceMatches(rule.resource, resource) &&
        rule.actions.some(a => this.actionMatches(a, action))
      )
      .sort((a, b) => b.priority - a.priority);

    for (const rule of applicableRules) {
      if (await this.evaluateConditions(rule.conditions, userId, context)) {
        return {
          allowed: rule.effect === 'allow',
          reason: `${rule.effect === 'allow' ? 'Allowed' : 'Denied'} by policy: ${rule.name}`,
          evaluatedPolicies: [rule.id]
        };
      }
    }

    return {
      allowed: false,
      reason: 'No matching ABAC policies'
    };
  }

  /**
   * Check for explicit deny policies
   */
  private async checkDenyPolicies(
    userId: string,
    resource: string,
    action: string,
    context?: AccessContext
  ): Promise<AccessDecision | null> {
    const denyRules = Array.from(this.policyRules.values())
      .filter(rule => 
        rule.enabled &&
        rule.effect === 'deny' &&
        this.resourceMatches(rule.resource, resource) &&
        rule.actions.some(a => this.actionMatches(a, action))
      )
      .sort((a, b) => b.priority - a.priority);

    for (const rule of denyRules) {
      if (await this.evaluateConditions(rule.conditions, userId, context)) {
        return {
          allowed: false,
          reason: `Denied by policy: ${rule.name}`,
          evaluatedPolicies: [rule.id]
        };
      }
    }

    return null;
  }

  /**
   * Evaluate policy conditions
   */
  private async evaluateConditions(
    conditions: PermissionCondition[],
    userId: string,
    context?: AccessContext
  ): Promise<boolean> {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    for (const condition of conditions) {
      const value = this.getConditionValue(condition.field, userId, context);
      if (!this.evaluateCondition(condition, value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper methods
   */
  private resourceMatches(pattern: string, resource: string): boolean {
    if (pattern === '*') return true;
    if (pattern === resource) return true;
    
    // Support wildcards
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(resource);
  }

  private actionMatches(pattern: string, action: string): boolean {
    if (pattern === '*') return true;
    if (pattern === action) return true;
    
    // Support wildcards
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(action);
  }

  private scopeMatches(permScope?: PermissionScope, context?: any): boolean {
    if (!permScope || permScope.type === 'global') return true;
    if (!context) return false;

    switch (permScope.type) {
      case 'organization':
        return permScope.entityId === context.organizationId;
      case 'team':
        return permScope.entityId === context.teamId;
      case 'project':
        return permScope.entityId === context.projectId;
      case 'self':
        return true; // Self scope is handled elsewhere
      default:
        return false;
    }
  }

  private evaluateCondition(condition: PermissionCondition, value: any): boolean {
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
      case 'regex':
        return new RegExp(String(condition.value)).test(String(value));
      default:
        return false;
    }
  }

  private getConditionValue(field: string, userId: string, context?: AccessContext): any {
    const parts = field.split('.');
    let value: any = { userId, ...context };

    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    return value;
  }

  private mergePermissions(permissions: Permission[]): Permission[] {
    const merged = new Map<string, Permission>();
    
    for (const perm of permissions) {
      const key = `${perm.resource}:${perm.action}:${JSON.stringify(perm.scope)}`;
      
      // Deny takes precedence
      if (perm.effect === 'deny') {
        merged.set(key, perm);
      } else if (!merged.has(key)) {
        merged.set(key, perm);
      }
    }

    return Array.from(merged.values());
  }

  private buildCacheKey(request: AccessRequest): string {
    return `access:${request.userId}:${request.resource}:${request.action}:${request.resourceId || 'global'}`;
  }

  private async clearUserCache(userId: string): Promise<void> {
    await this.cacheService.delete(`permissions:${userId}`);
    await this.cacheService.deletePattern(`access:${userId}:*`);
  }

  private async clearRoleCache(roleId: string): Promise<void> {
    // Clear cache for all users with this role
    const users = await prisma.user.findMany({
      where: { role: roleId as UserRole }
    });

    for (const user of users) {
      await this.clearUserCache(user.id);
    }
  }

  private async getRolePermissions(role: UserRole): Promise<Permission[]> {
    const systemRole = this.systemRoles.get(role);
    return systemRole?.permissions || [];
  }

  private async getTeamPermissions(teamId: string, role: TeamRole): Promise<Permission[]> {
    // Define team role permissions
    const teamPermissions: Record<TeamRole, Permission[]> = {
      OWNER: [
        { id: 't1', resource: 'team', action: '*', scope: { type: 'team', entityId: teamId }, effect: 'allow' }
      ],
      MAINTAINER: [
        { id: 't2', resource: 'team', action: 'read', scope: { type: 'team', entityId: teamId }, effect: 'allow' },
        { id: 't3', resource: 'team', action: 'update', scope: { type: 'team', entityId: teamId }, effect: 'allow' }
      ],
      MEMBER: [
        { id: 't4', resource: 'team', action: 'read', scope: { type: 'team', entityId: teamId }, effect: 'allow' }
      ]
    };

    return teamPermissions[role] || [];
  }

  private async getRole(roleId: string): Promise<Role | null> {
    return this.systemRoles.get(roleId) || null;
  }

  private async roleExists(name: string): Promise<boolean> {
    return Array.from(this.systemRoles.values()).some(r => r.name === name);
  }
}