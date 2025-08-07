/**
 * Role-Based Access Control (RBAC) System
 * Implements fine-grained access control for plugin operations
 * Supports hierarchical roles, permissions, and policy-based decisions
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import { AuditLogger } from '../logging/audit-logger';

// RBAC Schema Definitions
export const PermissionSchema = z.object({
  permissionId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  resource: z.string().min(1), // e.g., "plugin", "sandbox", "secret"
  action: z.string().min(1),   // e.g., "create", "read", "update", "delete", "execute"
  effect: z.enum(['allow', 'deny']),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in', 'regex']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
  })).optional(),
  metadata: z.record(z.string()),
  createdAt: z.date(),
  isActive: z.boolean()
});

export const RoleSchema = z.object({
  roleId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  permissions: z.array(z.string().uuid()),
  parentRoles: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
  isActive: z.boolean(),
  isSystem: z.boolean() // System roles cannot be deleted
});

export const UserAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  userId: z.string(),
  roleId: z.string().uuid(),
  scope: z.object({
    type: z.enum(['global', 'organization', 'project', 'plugin']),
    resourceId: z.string().optional()
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any()
  })).optional(),
  expiresAt: z.date().optional(),
  assignedAt: z.date(),
  assignedBy: z.string(),
  isActive: z.boolean()
});

export type Permission = z.infer<typeof PermissionSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type UserAssignment = z.infer<typeof UserAssignmentSchema>;

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  context: {
    pluginId?: string;
    instanceId?: string;
    organizationId?: string;
    projectId?: string;
    environment?: 'development' | 'staging' | 'production';
    clientIP?: string;
    userAgent?: string;
    requestId?: string;
    timestamp: Date;
    attributes?: Record<string, any>;
  };
}

export interface AccessDecision {
  decision: 'allow' | 'deny';
  reason: string;
  evaluatedPermissions: {
    permissionId: string;
    name: string;
    effect: 'allow' | 'deny';
    matched: boolean;
    conditions?: {
      field: string;
      operator: string;
      expected: any;
      actual: any;
      result: boolean;
    }[];
  }[];
  appliedRoles: string[];
  riskScore: number;
  requiredMFA?: boolean;
  sessionConstraints?: {
    maxDuration?: number;
    ipRestrictions?: string[];
    timeRestrictions?: {
      allowedHours: [number, number];
      allowedDays: number[];
      timezone: string;
    };
  };
  auditMetadata: Record<string, any>;
}

export interface RBACMetrics {
  totalUsers: number;
  totalRoles: number;
  totalPermissions: number;
  totalAssignments: number;
  accessRequests: {
    total: number;
    allowed: number;
    denied: number;
    last24h: number;
  };
  topDeniedResources: {
    resource: string;
    count: number;
  }[];
  complianceScore: number;
}

export class RBACSystem {
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private userAssignments: Map<string, UserAssignment[]> = new Map();
  private auditLogger: AuditLogger;
  private permissionCache: Map<string, AccessDecision> = new Map();
  private cacheExpiryTime = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.auditLogger = new AuditLogger();
    this.initializeSystemRoles();
  }

  /**
   * Create a new permission
   */
  async createPermission(permissionData: Omit<Permission, 'permissionId' | 'createdAt'>): Promise<Permission> {
    const permission: Permission = {
      permissionId: crypto.randomUUID(),
      ...permissionData,
      createdAt: new Date()
    };

    // Validate permission schema
    const validationResult = PermissionSchema.safeParse(permission);
    if (!validationResult.success) {
      throw new Error(`Invalid permission schema: ${validationResult.error.message}`);
    }

    // Store permission
    this.permissions.set(permission.permissionId, permission);

    // Clear cache
    this.clearPermissionCache();

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'PERMISSION_CREATED',
      permissionId: permission.permissionId,
      details: { name: permission.name, resource: permission.resource, action: permission.action }
    });

    return permission;
  }

  /**
   * Create a new role
   */
  async createRole(roleData: Omit<Role, 'roleId' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const now = new Date();
    const role: Role = {
      roleId: crypto.randomUUID(),
      ...roleData,
      createdAt: now,
      updatedAt: now
    };

    // Validate role schema
    const validationResult = RoleSchema.safeParse(role);
    if (!validationResult.success) {
      throw new Error(`Invalid role schema: ${validationResult.error.message}`);
    }

    // Validate permissions exist
    for (const permissionId of role.permissions) {
      if (!this.permissions.has(permissionId)) {
        throw new Error(`Permission ${permissionId} not found`);
      }
    }

    // Validate parent roles exist and detect circular dependencies
    if (role.parentRoles) {
      await this.validateRoleHierarchy(role.roleId, role.parentRoles);
    }

    // Store role
    this.roles.set(role.roleId, role);

    // Clear cache
    this.clearPermissionCache();

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'ROLE_CREATED',
      roleId: role.roleId,
      details: { name: role.name, permissions: role.permissions.length }
    });

    return role;
  }

  /**
   * Assign a role to a user
   */
  async assignRole(assignment: Omit<UserAssignment, 'assignmentId' | 'assignedAt'>): Promise<UserAssignment> {
    const userAssignment: UserAssignment = {
      assignmentId: crypto.randomUUID(),
      ...assignment,
      assignedAt: new Date()
    };

    // Validate assignment schema
    const validationResult = UserAssignmentSchema.safeParse(userAssignment);
    if (!validationResult.success) {
      throw new Error(`Invalid user assignment schema: ${validationResult.error.message}`);
    }

    // Validate role exists
    if (!this.roles.has(userAssignment.roleId)) {
      throw new Error(`Role ${userAssignment.roleId} not found`);
    }

    // Add to user assignments
    const existingAssignments = this.userAssignments.get(userAssignment.userId) || [];
    existingAssignments.push(userAssignment);
    this.userAssignments.set(userAssignment.userId, existingAssignments);

    // Clear cache for this user
    this.clearUserPermissionCache(userAssignment.userId);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'ROLE_ASSIGNED',
      userId: userAssignment.userId,
      roleId: userAssignment.roleId,
      assignmentId: userAssignment.assignmentId,
      details: { scope: userAssignment.scope, assignedBy: userAssignment.assignedBy }
    });

    return userAssignment;
  }

  /**
   * Check access for a user request
   */
  async checkAccess(request: AccessRequest): Promise<AccessDecision> {
    const cacheKey = this.generateAccessCacheKey(request);
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // Get user roles and permissions
    const userRoles = await this.getUserRoles(request.userId, request.context);
    const userPermissions = await this.getUserPermissions(userRoles);

    // Evaluate permissions
    const evaluatedPermissions = await this.evaluatePermissions(userPermissions, request);
    
    // Make access decision
    const decision = this.makeAccessDecision(evaluatedPermissions);
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(request, decision, userRoles);

    // Determine additional constraints
    const sessionConstraints = this.determineSessionConstraints(request, userRoles, riskScore);
    const requiredMFA = this.isRequiredMFA(request, userRoles, riskScore);

    const accessDecision: AccessDecision = {
      decision: decision.decision,
      reason: decision.reason,
      evaluatedPermissions,
      appliedRoles: userRoles.map(r => r.roleId),
      riskScore,
      requiredMFA,
      sessionConstraints,
      auditMetadata: {
        requestId: request.context.requestId || crypto.randomUUID(),
        timestamp: request.context.timestamp,
        userAgent: request.context.userAgent,
        clientIP: request.context.clientIP
      }
    };

    // Cache the decision
    this.permissionCache.set(cacheKey, accessDecision);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'ACCESS_DECISION',
      userId: request.userId,
      decision: accessDecision.decision,
      resource: request.resource,
      action: request.action,
      riskScore,
      details: {
        reason: accessDecision.reason,
        appliedRoles: accessDecision.appliedRoles,
        context: request.context
      }
    });

    return accessDecision;
  }

  /**
   * Get user's effective roles
   */
  async getUserRoles(userId: string, context?: AccessRequest['context']): Promise<Role[]> {
    const assignments = this.userAssignments.get(userId) || [];
    const activeAssignments = assignments.filter(assignment => 
      assignment.isActive &&
      (!assignment.expiresAt || assignment.expiresAt > new Date()) &&
      this.evaluateAssignmentConditions(assignment, context)
    );

    const roles = await Promise.all(
      activeAssignments.map(async assignment => {
        const role = this.roles.get(assignment.roleId);
        if (!role) return null;
        
        // Include parent roles recursively
        const allRoles = [role];
        if (role.parentRoles) {
          const parentRoles = await this.getParentRoles(role.parentRoles);
          allRoles.push(...parentRoles);
        }
        
        return allRoles;
      })
    );

    // Flatten and deduplicate
    const flatRoles = roles.flat().filter(Boolean) as Role[];
    const uniqueRoles = flatRoles.filter((role, index, array) => 
      array.findIndex(r => r.roleId === role.roleId) === index
    );

    return uniqueRoles.filter(role => role.isActive);
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(roles: Role[]): Promise<Permission[]> {
    const permissionIds = new Set<string>();
    
    roles.forEach(role => {
      role.permissions.forEach(permissionId => {
        permissionIds.add(permissionId);
      });
    });

    const permissions = Array.from(permissionIds)
      .map(id => this.permissions.get(id))
      .filter(Boolean) as Permission[];

    return permissions.filter(permission => permission.isActive);
  }

  /**
   * Revoke a role assignment
   */
  async revokeRoleAssignment(assignmentId: string, revokedBy: string): Promise<void> {
    // Find and deactivate assignment
    for (const [userId, assignments] of this.userAssignments.entries()) {
      const assignment = assignments.find(a => a.assignmentId === assignmentId);
      if (assignment) {
        assignment.isActive = false;
        
        // Clear cache for this user
        this.clearUserPermissionCache(userId);

        // Audit log
        await this.auditLogger.logSecurityEvent({
          eventType: 'ROLE_REVOKED',
          userId,
          roleId: assignment.roleId,
          assignmentId,
          details: { revokedBy }
        });
        
        return;
      }
    }

    throw new Error(`Assignment ${assignmentId} not found`);
  }

  /**
   * Update role permissions
   */
  async updateRole(roleId: string, updates: Partial<Omit<Role, 'roleId' | 'createdAt'>>): Promise<Role> {
    const existingRole = this.roles.get(roleId);
    if (!existingRole) {
      throw new Error(`Role ${roleId} not found`);
    }

    if (existingRole.isSystem && (updates.isActive === false || updates.permissions)) {
      throw new Error('Cannot modify system role');
    }

    const updatedRole: Role = {
      ...existingRole,
      ...updates,
      roleId, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    // Validate updated role
    const validationResult = RoleSchema.safeParse(updatedRole);
    if (!validationResult.success) {
      throw new Error(`Invalid role update: ${validationResult.error.message}`);
    }

    // Validate permissions exist
    if (updates.permissions) {
      for (const permissionId of updates.permissions) {
        if (!this.permissions.has(permissionId)) {
          throw new Error(`Permission ${permissionId} not found`);
        }
      }
    }

    // Validate parent roles
    if (updates.parentRoles) {
      await this.validateRoleHierarchy(roleId, updates.parentRoles);
    }

    // Store updated role
    this.roles.set(roleId, updatedRole);

    // Clear cache
    this.clearPermissionCache();

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'ROLE_UPDATED',
      roleId,
      details: { changes: updates }
    });

    return updatedRole;
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    // Check if role is assigned to any users
    const assignedUsers = this.getRoleAssignments(roleId);
    if (assignedUsers.length > 0) {
      throw new Error(`Cannot delete role ${roleId}: assigned to ${assignedUsers.length} users`);
    }

    // Check if role is a parent of other roles
    const childRoles = Array.from(this.roles.values()).filter(r => 
      r.parentRoles?.includes(roleId)
    );
    if (childRoles.length > 0) {
      throw new Error(`Cannot delete role ${roleId}: is parent of ${childRoles.length} roles`);
    }

    // Delete role
    this.roles.delete(roleId);

    // Clear cache
    this.clearPermissionCache();

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'ROLE_DELETED',
      roleId,
      details: { name: role.name }
    });
  }

  /**
   * Get RBAC system metrics
   */
  getRBACMetrics(): RBACMetrics {
    const totalUsers = this.userAssignments.size;
    const totalRoles = this.roles.size;
    const totalPermissions = this.permissions.size;
    const totalAssignments = Array.from(this.userAssignments.values())
      .flat()
      .filter(a => a.isActive).length;

    // Mock metrics - in production would query audit logs
    return {
      totalUsers,
      totalRoles,
      totalPermissions,
      totalAssignments,
      accessRequests: {
        total: 1000,
        allowed: 950,
        denied: 50,
        last24h: 100
      },
      topDeniedResources: [
        { resource: 'plugin:create', count: 20 },
        { resource: 'sandbox:delete', count: 15 },
        { resource: 'secret:read', count: 10 }
      ],
      complianceScore: 95
    };
  }

  /**
   * List all roles
   */
  getRoles(): Role[] {
    return Array.from(this.roles.values()).filter(role => role.isActive);
  }

  /**
   * List all permissions
   */
  getPermissions(): Permission[] {
    return Array.from(this.permissions.values()).filter(permission => permission.isActive);
  }

  /**
   * Get role by ID
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  /**
   * Get permission by ID
   */
  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  // Private helper methods
  private async initializeSystemRoles(): Promise<void> {
    const systemRoles = this.getDefaultSystemRoles();
    const systemPermissions = this.getDefaultSystemPermissions();

    // Create default permissions
    for (const permission of systemPermissions) {
      this.permissions.set(permission.permissionId, permission);
    }

    // Create default roles
    for (const role of systemRoles) {
      this.roles.set(role.roleId, role);
    }
  }

  private getDefaultSystemPermissions(): Permission[] {
    const now = new Date();
    return [
      {
        permissionId: 'perm-plugin-create',
        name: 'Create Plugin',
        description: 'Permission to create new plugins',
        resource: 'plugin',
        action: 'create',
        effect: 'allow',
        metadata: { system: 'true' },
        createdAt: now,
        isActive: true
      },
      {
        permissionId: 'perm-plugin-read',
        name: 'Read Plugin',
        description: 'Permission to view plugin details',
        resource: 'plugin',
        action: 'read',
        effect: 'allow',
        metadata: { system: 'true' },
        createdAt: now,
        isActive: true
      },
      {
        permissionId: 'perm-plugin-update',
        name: 'Update Plugin',
        description: 'Permission to modify plugins',
        resource: 'plugin',
        action: 'update',
        effect: 'allow',
        metadata: { system: 'true' },
        createdAt: now,
        isActive: true
      },
      {
        permissionId: 'perm-plugin-delete',
        name: 'Delete Plugin',
        description: 'Permission to delete plugins',
        resource: 'plugin',
        action: 'delete',
        effect: 'allow',
        metadata: { system: 'true' },
        createdAt: now,
        isActive: true
      },
      {
        permissionId: 'perm-sandbox-create',
        name: 'Create Sandbox',
        description: 'Permission to create plugin sandboxes',
        resource: 'sandbox',
        action: 'create',
        effect: 'allow',
        metadata: { system: 'true' },
        createdAt: now,
        isActive: true
      },
      {
        permissionId: 'perm-sandbox-execute',
        name: 'Execute in Sandbox',
        description: 'Permission to execute code in sandboxes',
        resource: 'sandbox',
        action: 'execute',
        effect: 'allow',
        metadata: { system: 'true' },
        createdAt: now,
        isActive: true
      },
      {
        permissionId: 'perm-secret-read',
        name: 'Read Secrets',
        description: 'Permission to read secret values',
        resource: 'secret',
        action: 'read',
        effect: 'allow',
        metadata: { system: 'true' },
        createdAt: now,
        isActive: true
      }
    ];
  }

  private getDefaultSystemRoles(): Role[] {
    const now = new Date();
    return [
      {
        roleId: 'role-admin',
        name: 'Administrator',
        description: 'Full system administration privileges',
        permissions: [
          'perm-plugin-create',
          'perm-plugin-read',
          'perm-plugin-update',
          'perm-plugin-delete',
          'perm-sandbox-create',
          'perm-sandbox-execute',
          'perm-secret-read'
        ],
        metadata: { system: 'true' },
        createdAt: now,
        updatedAt: now,
        isActive: true,
        isSystem: true
      },
      {
        roleId: 'role-developer',
        name: 'Developer',
        description: 'Standard developer privileges',
        permissions: [
          'perm-plugin-read',
          'perm-plugin-create',
          'perm-sandbox-create',
          'perm-sandbox-execute'
        ],
        metadata: { system: 'true' },
        createdAt: now,
        updatedAt: now,
        isActive: true,
        isSystem: true
      },
      {
        roleId: 'role-viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [
          'perm-plugin-read'
        ],
        metadata: { system: 'true' },
        createdAt: now,
        updatedAt: now,
        isActive: true,
        isSystem: true
      }
    ];
  }

  private async validateRoleHierarchy(roleId: string, parentRoles: string[]): Promise<void> {
    for (const parentRoleId of parentRoles) {
      if (!this.roles.has(parentRoleId)) {
        throw new Error(`Parent role ${parentRoleId} not found`);
      }
      
      // Check for circular dependencies
      if (await this.hasCircularDependency(roleId, parentRoleId)) {
        throw new Error(`Circular dependency detected: ${roleId} -> ${parentRoleId}`);
      }
    }
  }

  private async hasCircularDependency(roleId: string, parentRoleId: string): Promise<boolean> {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (currentRoleId: string): boolean => {
      if (recursionStack.has(currentRoleId)) {
        return true; // Circular dependency found
      }
      if (visited.has(currentRoleId)) {
        return false;
      }

      visited.add(currentRoleId);
      recursionStack.add(currentRoleId);

      const role = this.roles.get(currentRoleId);
      if (role?.parentRoles) {
        for (const parent of role.parentRoles) {
          if (dfs(parent)) {
            return true;
          }
        }
      }

      recursionStack.delete(currentRoleId);
      return false;
    };

    return dfs(parentRoleId);
  }

  private async getParentRoles(parentRoleIds: string[]): Promise<Role[]> {
    const parentRoles: Role[] = [];
    
    for (const parentRoleId of parentRoleIds) {
      const parentRole = this.roles.get(parentRoleId);
      if (parentRole && parentRole.isActive) {
        parentRoles.push(parentRole);
        
        // Recursively get parent roles
        if (parentRole.parentRoles) {
          const grandParentRoles = await this.getParentRoles(parentRole.parentRoles);
          parentRoles.push(...grandParentRoles);
        }
      }
    }

    return parentRoles;
  }

  private evaluateAssignmentConditions(assignment: UserAssignment, context?: AccessRequest['context']): boolean {
    if (!assignment.conditions || !context) {
      return true;
    }

    for (const condition of assignment.conditions) {
      const contextValue = this.getContextValue(context, condition.field);
      if (!this.evaluateCondition(contextValue, condition.operator, condition.value)) {
        return false;
      }
    }

    return true;
  }

  private getContextValue(context: AccessRequest['context'], field: string): any {
    const fieldParts = field.split('.');
    let value: any = context;
    
    for (const part of fieldParts) {
      value = value?.[part];
      if (value === undefined) {
        return undefined;
      }
    }
    
    return value;
  }

  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return typeof actual === 'string' && actual.includes(expected);
      case 'not_contains':
        return typeof actual === 'string' && !actual.includes(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'regex':
        return typeof actual === 'string' && new RegExp(expected).test(actual);
      default:
        return false;
    }
  }

  private async evaluatePermissions(permissions: Permission[], request: AccessRequest): Promise<AccessDecision['evaluatedPermissions']> {
    const evaluatedPermissions: AccessDecision['evaluatedPermissions'] = [];

    for (const permission of permissions) {
      const matched = this.isPermissionMatch(permission, request);
      const conditionResults = permission.conditions ? 
        await this.evaluatePermissionConditions(permission.conditions, request) : undefined;

      evaluatedPermissions.push({
        permissionId: permission.permissionId,
        name: permission.name,
        effect: permission.effect,
        matched,
        conditions: conditionResults
      });
    }

    return evaluatedPermissions;
  }

  private isPermissionMatch(permission: Permission, request: AccessRequest): boolean {
    return permission.resource === request.resource && permission.action === request.action;
  }

  private async evaluatePermissionConditions(conditions: Permission['conditions'], request: AccessRequest): Promise<AccessDecision['evaluatedPermissions'][0]['conditions']> {
    if (!conditions) return undefined;

    const results = conditions.map(condition => {
      const actualValue = this.getContextValue(request.context, condition.field);
      const result = this.evaluateCondition(actualValue, condition.operator, condition.value);
      
      return {
        field: condition.field,
        operator: condition.operator,
        expected: condition.value,
        actual: actualValue,
        result
      };
    });

    return results;
  }

  private makeAccessDecision(evaluatedPermissions: AccessDecision['evaluatedPermissions']): { decision: 'allow' | 'deny'; reason: string } {
    // Check for explicit deny permissions first
    const denyPermissions = evaluatedPermissions.filter(p => 
      p.matched && p.effect === 'deny' && 
      (!p.conditions || p.conditions.every(c => c.result))
    );

    if (denyPermissions.length > 0) {
      return {
        decision: 'deny',
        reason: `Explicit deny permission: ${denyPermissions[0].name}`
      };
    }

    // Check for allow permissions
    const allowPermissions = evaluatedPermissions.filter(p => 
      p.matched && p.effect === 'allow' && 
      (!p.conditions || p.conditions.every(c => c.result))
    );

    if (allowPermissions.length > 0) {
      return {
        decision: 'allow',
        reason: `Allow permission: ${allowPermissions[0].name}`
      };
    }

    // Default deny
    return {
      decision: 'deny',
      reason: 'No matching allow permission found'
    };
  }

  private calculateRiskScore(request: AccessRequest, decision: { decision: 'allow' | 'deny'; reason: string }, roles: Role[]): number {
    let riskScore = 0;

    // Higher risk for sensitive resources
    if (request.resource === 'secret' || request.resource === 'sandbox') {
      riskScore += 20;
    }

    // Higher risk for destructive actions
    if (request.action === 'delete' || request.action === 'execute') {
      riskScore += 15;
    }

    // Higher risk for production environment
    if (request.context.environment === 'production') {
      riskScore += 10;
    }

    // Higher risk for privileged roles
    const hasAdminRole = roles.some(role => role.name === 'Administrator');
    if (hasAdminRole) {
      riskScore += 10;
    }

    // Time-based risk (outside business hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 5;
    }

    return Math.min(100, riskScore);
  }

  private determineSessionConstraints(request: AccessRequest, roles: Role[], riskScore: number): AccessDecision['sessionConstraints'] {
    const constraints: AccessDecision['sessionConstraints'] = {};

    // High-risk operations have shorter session duration
    if (riskScore > 70) {
      constraints.maxDuration = 30 * 60; // 30 minutes
    } else if (riskScore > 40) {
      constraints.maxDuration = 60 * 60; // 1 hour
    }

    // Production access has time restrictions
    if (request.context.environment === 'production') {
      constraints.timeRestrictions = {
        allowedHours: [6, 22], // 6 AM to 10 PM
        allowedDays: [1, 2, 3, 4, 5], // Monday to Friday
        timezone: 'UTC'
      };
    }

    return Object.keys(constraints).length > 0 ? constraints : undefined;
  }

  private isRequiredMFA(request: AccessRequest, roles: Role[], riskScore: number): boolean {
    // Require MFA for high-risk operations
    if (riskScore > 50) return true;
    
    // Require MFA for sensitive resources
    if (request.resource === 'secret' && request.action === 'read') return true;
    if (request.resource === 'sandbox' && request.action === 'delete') return true;
    
    // Require MFA for admin roles
    const hasAdminRole = roles.some(role => role.name === 'Administrator');
    if (hasAdminRole) return true;

    return false;
  }

  private getRoleAssignments(roleId: string): UserAssignment[] {
    const assignments: UserAssignment[] = [];
    
    for (const userAssignments of this.userAssignments.values()) {
      const roleAssignments = userAssignments.filter(a => a.roleId === roleId && a.isActive);
      assignments.push(...roleAssignments);
    }

    return assignments;
  }

  private generateAccessCacheKey(request: AccessRequest): string {
    return createHash('sha256')
      .update(JSON.stringify({
        userId: request.userId,
        resource: request.resource,
        action: request.action,
        context: {
          pluginId: request.context.pluginId,
          environment: request.context.environment
        }
      }))
      .digest('hex');
  }

  private isCacheValid(decision: AccessDecision): boolean {
    if (!decision.auditMetadata.timestamp) return false;
    const age = Date.now() - new Date(decision.auditMetadata.timestamp).getTime();
    return age < this.cacheExpiryTime;
  }

  private clearPermissionCache(): void {
    this.permissionCache.clear();
  }

  private clearUserPermissionCache(userId: string): void {
    for (const [key, decision] of this.permissionCache.entries()) {
      // This is simplified - would need better cache key structure
      if (key.includes(userId)) {
        this.permissionCache.delete(key);
      }
    }
  }
}

export { RBACSystem };