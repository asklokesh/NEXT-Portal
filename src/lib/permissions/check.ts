/**
 * Simplified Permission Check Interface
 * 
 * Provides a simplified interface for permission checking that matches
 * the expected signature used by API routes.
 * 
 * This module bridges the gap between the comprehensive permission system
 * and the simplified usage patterns in API routes.
 */

import { checkPermission as checkPermissionFull } from './helpers';
import { 
  ResourceType, 
  PermissionAction, 
  PermissionContext 
} from './types';

/**
 * Simplified permission check function for API routes
 * 
 * This function provides a simpler interface that matches the usage pattern
 * in existing API routes while leveraging the full permission system.
 * 
 * @param userId - The ID of the user to check permissions for
 * @param permission - The permission string in format "resource:action" or just resource
 * @param tenantId - The tenant ID for multi-tenant permission checking
 * @returns Promise<boolean> - True if user has permission, false otherwise
 * 
 * @example
 * ```typescript
 * const hasPermission = await checkPermission(user.id, 'catalog:entities:read', tenantId);
 * if (!hasPermission) {
 *   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 * }
 * ```
 */
export async function checkPermission(
  userId: string,
  permission: string,
  tenantId?: string
): Promise<boolean> {
  try {
    // Validate input parameters
    if (!userId || typeof userId !== 'string') {
      console.warn('Invalid userId provided to checkPermission:', userId);
      return false;
    }

    if (!permission || typeof permission !== 'string') {
      console.warn('Invalid permission provided to checkPermission:', permission);
      return false;
    }

    // Parse permission string (format: "resource:action" or just "resource")
    const permissionParts = permission.split(':');
    let resource: ResourceType;
    let action: PermissionAction;

    if (permissionParts.length >= 2) {
      // Format: "catalog:entities:read" -> resource: "catalog", action: "read"
      resource = permissionParts[0] as ResourceType;
      action = permissionParts[permissionParts.length - 1] as PermissionAction;
    } else {
      // Format: "catalog" -> resource: "catalog", action: "read" (default)
      resource = permission as ResourceType;
      action = 'read' as PermissionAction;
    }

    // Create permission context
    const context: PermissionContext = {
      tenantId: tenantId || 'default',
      timestamp: new Date().toISOString(),
      source: 'api-route',
      metadata: {
        originalPermission: permission,
        parsedResource: resource,
        parsedAction: action
      }
    };

    // Call the full permission check function
    const result = await checkPermissionFull(
      userId,
      resource,
      action,
      undefined, // resourceId - not used in simplified interface
      context
    );

    return result;
  } catch (error) {
    console.error('Error in simplified permission check:', {
      userId,
      permission,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Fail securely - deny permission on error
    return false;
  }
}

/**
 * Batch permission check for multiple permissions
 * 
 * @param userId - The ID of the user to check permissions for
 * @param permissions - Array of permission strings to check
 * @param tenantId - The tenant ID for multi-tenant permission checking
 * @returns Promise<Record<string, boolean>> - Map of permission -> boolean
 */
export async function checkPermissions(
  userId: string,
  permissions: string[],
  tenantId?: string
): Promise<Record<string, boolean>> {
  if (!Array.isArray(permissions)) {
    console.warn('Invalid permissions array provided to checkPermissions:', permissions);
    return {};
  }

  const results: Record<string, boolean> = {};
  
  // Check permissions in parallel for better performance
  const checks = permissions.map(async (permission) => {
    const hasPermission = await checkPermission(userId, permission, tenantId);
    return { permission, hasPermission };
  });

  try {
    const checkResults = await Promise.all(checks);
    
    for (const { permission, hasPermission } of checkResults) {
      results[permission] = hasPermission;
    }
  } catch (error) {
    console.error('Error in batch permission check:', error);
    
    // Return false for all permissions on error
    for (const permission of permissions) {
      results[permission] = false;
    }
  }

  return results;
}

/**
 * Check if user has any of the specified permissions
 * 
 * @param userId - The ID of the user to check permissions for
 * @param permissions - Array of permission strings to check
 * @param tenantId - The tenant ID for multi-tenant permission checking
 * @returns Promise<boolean> - True if user has at least one permission
 */
export async function hasAnyPermission(
  userId: string,
  permissions: string[],
  tenantId?: string
): Promise<boolean> {
  const results = await checkPermissions(userId, permissions, tenantId);
  return Object.values(results).some(hasPermission => hasPermission === true);
}

/**
 * Check if user has all of the specified permissions
 * 
 * @param userId - The ID of the user to check permissions for
 * @param permissions - Array of permission strings to check
 * @param tenantId - The tenant ID for multi-tenant permission checking
 * @returns Promise<boolean> - True if user has all permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: string[],
  tenantId?: string
): Promise<boolean> {
  const results = await checkPermissions(userId, permissions, tenantId);
  return Object.values(results).every(hasPermission => hasPermission === true);
}

/**
 * Middleware function for permission checking in API routes
 * 
 * @param requiredPermission - The permission required to access the route
 * @returns Function that can be used as middleware
 */
export function requirePermission(requiredPermission: string) {
  return async (userId: string, tenantId?: string): Promise<boolean> => {
    return await checkPermission(userId, requiredPermission, tenantId);
  };
}

// Export types for better TypeScript support
export type { ResourceType, PermissionAction, PermissionContext } from './types';