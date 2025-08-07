/**
 * Permission Helpers
 * Utility functions for permission checks
 */

import { getPermissionEngine } from './index';
import {
  PermissionCheckRequest,
  PermissionDecision,
  ResourceType,
  PermissionAction,
  PermissionContext
} from './types';

/**
 * Check if user has permission
 */
export async function checkPermission(
  userId: string,
  resource: ResourceType,
  action: PermissionAction,
  resourceId?: string,
  context?: PermissionContext
): Promise<boolean> {
  const engine = getPermissionEngine();
  
  const request: PermissionCheckRequest = {
    userId,
    resource,
    action,
    resourceId,
    context
  };

  const decision = await engine.checkPermission(request);
  return decision.allowed;
}

/**
 * Check multiple permissions
 */
export async function checkPermissions(
  userId: string,
  permissions: Array<{
    resource: ResourceType;
    action: PermissionAction;
    resourceId?: string;
  }>
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const engine = getPermissionEngine();

  await Promise.all(
    permissions.map(async (perm) => {
      const key = `${perm.resource}:${perm.action}:${perm.resourceId || 'global'}`;
      const decision = await engine.checkPermission({
        userId,
        resource: perm.resource,
        action: perm.action,
        resourceId: perm.resourceId
      });
      results.set(key, decision.allowed);
    })
  );

  return results;
}

/**
 * Require permission (throws if denied)
 */
export async function requirePermission(
  userId: string,
  resource: ResourceType,
  action: PermissionAction,
  resourceId?: string,
  context?: PermissionContext
): Promise<void> {
  const allowed = await checkPermission(
    userId,
    resource,
    action,
    resourceId,
    context
  );

  if (!allowed) {
    throw new PermissionDeniedError(
      `Permission denied: ${action} on ${resource}`
    );
  }
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(
  userId: string,
  roles: string[]
): Promise<boolean> {
  const { getRoleManager } = await import('./index');
  const roleManager = getRoleManager();
  const userRoles = await roleManager.getUserRoles(userId);
  
  return userRoles.some(userRole => 
    roles.includes(userRole.id) || roles.includes(userRole.name)
  );
}

/**
 * Check if user has all specified roles
 */
export async function hasAllRoles(
  userId: string,
  roles: string[]
): Promise<boolean> {
  const { getRoleManager } = await import('./index');
  const roleManager = getRoleManager();
  const userRoles = await roleManager.getUserRoles(userId);
  
  const userRoleIds = new Set(
    userRoles.flatMap(r => [r.id, r.name])
  );
  
  return roles.every(role => userRoleIds.has(role));
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return hasAnyRole(userId, ['admin', 'role-admin']);
}

/**
 * Check if user owns resource
 */
export async function isResourceOwner(
  userId: string,
  resourceId: string,
  resourceType: ResourceType
): Promise<boolean> {
  // This would typically check ownership in database
  // For now, using context-based check
  const context: PermissionContext = {
    entityOwner: userId
  };

  return checkPermission(
    userId,
    resourceType,
    PermissionAction.MANAGE,
    resourceId,
    context
  );
}

/**
 * Get user's effective permissions
 */
export async function getUserPermissions(
  userId: string
): Promise<Array<{ resource: ResourceType; action: PermissionAction }>> {
  const { getRoleManager } = await import('./index');
  const roleManager = getRoleManager();
  const roles = await roleManager.getUserRoles(userId);
  
  const permissions = new Map<string, { resource: ResourceType; action: PermissionAction }>();
  
  for (const role of roles) {
    for (const perm of role.permissions) {
      const key = `${perm.resource}:${perm.action}`;
      if (!permissions.has(key)) {
        permissions.set(key, {
          resource: perm.resource,
          action: perm.action
        });
      }
    }
  }
  
  return Array.from(permissions.values());
}

/**
 * Custom error for permission denied
 */
export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}