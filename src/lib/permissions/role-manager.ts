/**
 * Role Manager
 * Manages roles, permissions, and role assignments
 */

import { prisma } from '@/lib/db/client';
import {
  Role,
  Permission,
  RoleAssignment,
  SystemRole,
  SystemRoles,
  ResourceType,
  PermissionAction,
  PermissionScope
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class RoleManager {
  private roleCache: Map<string, Role>;
  private systemRoles: Map<SystemRole, Role>;

  constructor() {
    this.roleCache = new Map();
    this.systemRoles = new Map();
    this.initializeSystemRoles();
  }

  /**
   * Initialize system roles
   */
  private async initializeSystemRoles(): Promise<void> {
    // Admin role - full access
    this.systemRoles.set(SystemRoles.ADMIN, {
      id: 'role-admin',
      name: 'Administrator',
      description: 'Full system access',
      isSystem: true,
      isCustom: false,
      permissions: this.generateAdminPermissions(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Developer role - standard developer access
    this.systemRoles.set(SystemRoles.DEVELOPER, {
      id: 'role-developer',
      name: 'Developer',
      description: 'Standard developer access',
      isSystem: true,
      isCustom: false,
      permissions: this.generateDeveloperPermissions(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Viewer role - read-only access
    this.systemRoles.set(SystemRoles.VIEWER, {
      id: 'role-viewer',
      name: 'Viewer',
      description: 'Read-only access',
      isSystem: true,
      isCustom: false,
      permissions: this.generateViewerPermissions(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Owner role - resource owner permissions
    this.systemRoles.set(SystemRoles.OWNER, {
      id: 'role-owner',
      name: 'Owner',
      description: 'Resource owner permissions',
      isSystem: true,
      isCustom: false,
      permissions: this.generateOwnerPermissions(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Guest role - minimal access
    this.systemRoles.set(SystemRoles.GUEST, {
      id: 'role-guest',
      name: 'Guest',
      description: 'Guest user with minimal access',
      isSystem: true,
      isCustom: false,
      permissions: this.generateGuestPermissions(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Generate admin permissions
   */
  private generateAdminPermissions(): Permission[] {
    const permissions: Permission[] = [];
    const resources = Object.values(ResourceType);
    const actions = Object.values(PermissionAction);

    for (const resource of resources) {
      for (const action of actions) {
        permissions.push({
          id: `perm-admin-${resource}-${action}`,
          resource,
          action,
          scope: { type: 'global' }
        });
      }
    }

    return permissions;
  }

  /**
   * Generate developer permissions
   */
  private generateDeveloperPermissions(): Permission[] {
    return [
      // Catalog permissions
      { id: 'perm-dev-catalog-create', resource: ResourceType.CATALOG, action: PermissionAction.CREATE, scope: { type: 'team' } },
      { id: 'perm-dev-catalog-read', resource: ResourceType.CATALOG, action: PermissionAction.READ, scope: { type: 'global' } },
      { id: 'perm-dev-catalog-update', resource: ResourceType.CATALOG, action: PermissionAction.UPDATE, scope: { type: 'team' } },
      { id: 'perm-dev-catalog-delete', resource: ResourceType.CATALOG, action: PermissionAction.DELETE, scope: { type: 'self' } },
      
      // Entity permissions
      { id: 'perm-dev-entity-create', resource: ResourceType.ENTITY, action: PermissionAction.CREATE, scope: { type: 'team' } },
      { id: 'perm-dev-entity-read', resource: ResourceType.ENTITY, action: PermissionAction.READ, scope: { type: 'global' } },
      { id: 'perm-dev-entity-update', resource: ResourceType.ENTITY, action: PermissionAction.UPDATE, scope: { type: 'team' } },
      
      // Template permissions
      { id: 'perm-dev-template-create', resource: ResourceType.TEMPLATE, action: PermissionAction.CREATE, scope: { type: 'team' } },
      { id: 'perm-dev-template-read', resource: ResourceType.TEMPLATE, action: PermissionAction.READ, scope: { type: 'global' } },
      { id: 'perm-dev-template-execute', resource: ResourceType.TEMPLATE, action: PermissionAction.EXECUTE, scope: { type: 'global' } },
      
      // Plugin permissions
      { id: 'perm-dev-plugin-read', resource: ResourceType.PLUGIN, action: PermissionAction.READ, scope: { type: 'global' } },
      { id: 'perm-dev-plugin-execute', resource: ResourceType.PLUGIN, action: PermissionAction.EXECUTE, scope: { type: 'team' } },
      
      // Documentation permissions
      { id: 'perm-dev-docs-create', resource: ResourceType.DOCUMENTATION, action: PermissionAction.CREATE, scope: { type: 'team' } },
      { id: 'perm-dev-docs-read', resource: ResourceType.DOCUMENTATION, action: PermissionAction.READ, scope: { type: 'global' } },
      { id: 'perm-dev-docs-update', resource: ResourceType.DOCUMENTATION, action: PermissionAction.UPDATE, scope: { type: 'team' } },
      
      // Workflow permissions
      { id: 'perm-dev-workflow-create', resource: ResourceType.WORKFLOW, action: PermissionAction.CREATE, scope: { type: 'team' } },
      { id: 'perm-dev-workflow-read', resource: ResourceType.WORKFLOW, action: PermissionAction.READ, scope: { type: 'global' } },
      { id: 'perm-dev-workflow-execute', resource: ResourceType.WORKFLOW, action: PermissionAction.EXECUTE, scope: { type: 'team' } },
      
      // Monitoring permissions
      { id: 'perm-dev-monitoring-read', resource: ResourceType.MONITORING, action: PermissionAction.READ, scope: { type: 'team' } },
      
      // Deployment permissions
      { id: 'perm-dev-deployment-read', resource: ResourceType.DEPLOYMENT, action: PermissionAction.READ, scope: { type: 'team' } },
      { id: 'perm-dev-deployment-create', resource: ResourceType.DEPLOYMENT, action: PermissionAction.CREATE, scope: { type: 'team' } }
    ];
  }

  /**
   * Generate viewer permissions
   */
  private generateViewerPermissions(): Permission[] {
    const readableResources = [
      ResourceType.CATALOG,
      ResourceType.ENTITY,
      ResourceType.TEMPLATE,
      ResourceType.PLUGIN,
      ResourceType.DOCUMENTATION,
      ResourceType.WORKFLOW,
      ResourceType.MONITORING,
      ResourceType.DEPLOYMENT
    ];

    return readableResources.map(resource => ({
      id: `perm-viewer-${resource}-read`,
      resource,
      action: PermissionAction.READ,
      scope: { type: 'global' as const }
    }));
  }

  /**
   * Generate owner permissions
   */
  private generateOwnerPermissions(): Permission[] {
    return [
      // Full control over owned resources
      { id: 'perm-owner-entity-manage', resource: ResourceType.ENTITY, action: PermissionAction.MANAGE, scope: { type: 'self' } },
      { id: 'perm-owner-catalog-manage', resource: ResourceType.CATALOG, action: PermissionAction.MANAGE, scope: { type: 'self' } },
      { id: 'perm-owner-template-manage', resource: ResourceType.TEMPLATE, action: PermissionAction.MANAGE, scope: { type: 'self' } },
      { id: 'perm-owner-workflow-manage', resource: ResourceType.WORKFLOW, action: PermissionAction.MANAGE, scope: { type: 'self' } }
    ];
  }

  /**
   * Generate guest permissions
   */
  private generateGuestPermissions(): Permission[] {
    return [
      { id: 'perm-guest-catalog-read', resource: ResourceType.CATALOG, action: PermissionAction.READ, scope: { type: 'global' } },
      { id: 'perm-guest-docs-read', resource: ResourceType.DOCUMENTATION, action: PermissionAction.READ, scope: { type: 'global' } }
    ];
  }

  /**
   * Create custom role
   */
  async createRole(role: {
    name: string;
    description: string;
    permissions: Permission[];
    inheritedRoles?: string[];
  }): Promise<Role> {
    const newRole: Role = {
      id: uuidv4(),
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isSystem: false,
      isCustom: true,
      inheritedRoles: role.inheritedRoles,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store in database
    await this.saveRole(newRole);
    
    // Update cache
    this.roleCache.set(newRole.id, newRole);

    return newRole;
  }

  /**
   * Update role
   */
  async updateRole(
    roleId: string,
    updates: Partial<Role>
  ): Promise<Role> {
    const role = await this.getRole(roleId);
    
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    if (role.isSystem) {
      throw new Error('Cannot modify system roles');
    }

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: role.id,
      isSystem: role.isSystem,
      updatedAt: new Date()
    };

    await this.saveRole(updatedRole);
    this.roleCache.set(roleId, updatedRole);

    return updatedRole;
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = await this.getRole(roleId);
    
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    // Remove from database
    await prisma.$executeRaw`
      DELETE FROM roles WHERE id = ${roleId}
    `;

    // Remove from cache
    this.roleCache.delete(roleId);
  }

  /**
   * Get role by ID
   */
  async getRole(roleId: string): Promise<Role | null> {
    // Check cache first
    if (this.roleCache.has(roleId)) {
      return this.roleCache.get(roleId)!;
    }

    // Check system roles
    for (const [, role] of this.systemRoles) {
      if (role.id === roleId) {
        return role;
      }
    }

    // Load from database
    try {
      const dbRole = await prisma.$queryRaw`
        SELECT * FROM roles WHERE id = ${roleId}
      `;

      if (dbRole && (dbRole as any[]).length > 0) {
        const role = this.mapDbRole((dbRole as any[])[0]);
        this.roleCache.set(roleId, role);
        return role;
      }
    } catch (error) {
      console.error('Failed to load role:', error);
    }

    return null;
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    const roles: Role[] = [];

    // Add system roles
    for (const [, role] of this.systemRoles) {
      roles.push(role);
    }

    // Load custom roles from database
    try {
      const dbRoles = await prisma.$queryRaw`
        SELECT * FROM roles WHERE is_custom = true
      `;

      for (const dbRole of dbRoles as any[]) {
        roles.push(this.mapDbRole(dbRole));
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }

    return roles;
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    scope?: PermissionScope,
    expiresAt?: Date
  ): Promise<RoleAssignment> {
    const assignment: RoleAssignment = {
      id: uuidv4(),
      userId,
      roleId,
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
      scope
    };

    // Store in database
    await prisma.$executeRaw`
      INSERT INTO role_assignments (
        id, user_id, role_id, assigned_by, assigned_at, expires_at, scope
      ) VALUES (
        ${assignment.id}, ${assignment.userId}, ${assignment.roleId},
        ${assignment.assignedBy}, ${assignment.assignedAt}, ${assignment.expiresAt},
        ${JSON.stringify(assignment.scope)}
      )
    `;

    return assignment;
  }

  /**
   * Revoke role from user
   */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM role_assignments
      WHERE user_id = ${userId} AND role_id = ${roleId}
    `;
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const assignments = await prisma.$queryRaw`
        SELECT role_id FROM role_assignments
        WHERE user_id = ${userId}
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      const roles: Role[] = [];
      for (const assignment of assignments as any[]) {
        const role = await this.getRole(assignment.role_id);
        if (role) {
          roles.push(role);
        }
      }

      return roles;
    } catch (error) {
      console.error('Failed to get user roles:', error);
      return [];
    }
  }

  /**
   * Save role to database
   */
  private async saveRole(role: Role): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO roles (
        id, name, description, permissions, is_system, is_custom,
        inherited_roles, metadata, created_at, updated_at
      ) VALUES (
        ${role.id}, ${role.name}, ${role.description},
        ${JSON.stringify(role.permissions)}, ${role.isSystem}, ${role.isCustom},
        ${JSON.stringify(role.inheritedRoles)}, ${JSON.stringify(role.metadata)},
        ${role.createdAt}, ${role.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions,
        inherited_roles = EXCLUDED.inherited_roles,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `;
  }

  /**
   * Map database role to Role type
   */
  private mapDbRole(dbRole: any): Role {
    return {
      id: dbRole.id,
      name: dbRole.name,
      description: dbRole.description,
      permissions: JSON.parse(dbRole.permissions || '[]'),
      isSystem: dbRole.is_system,
      isCustom: dbRole.is_custom,
      inheritedRoles: JSON.parse(dbRole.inherited_roles || '[]'),
      metadata: JSON.parse(dbRole.metadata || '{}'),
      createdAt: dbRole.created_at,
      updatedAt: dbRole.updated_at
    };
  }
}