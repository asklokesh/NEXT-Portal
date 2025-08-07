/**
 * Permission Decorators
 * Decorators for method-level permission checks
 */

import { checkPermission, requirePermission } from './helpers';
import { ResourceType, PermissionAction } from './types';

/**
 * Decorator to check permission before method execution
 */
export function withPermission(
  resource: ResourceType,
  action: PermissionAction
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract userId from context (assumes first arg is context with userId)
      const context = args[0];
      const userId = context?.userId || context?.user?.id;

      if (!userId) {
        throw new Error('User ID not found in context');
      }

      // Check permission
      await requirePermission(userId, resource, action);

      // Call original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Decorator to check if user has specific role
 */
export function requireRole(role: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args[0];
      const userId = context?.userId || context?.user?.id;

      if (!userId) {
        throw new Error('User ID not found in context');
      }

      const { hasAnyRole } = await import('./helpers');
      const hasRole = await hasAnyRole(userId, [role]);

      if (!hasRole) {
        throw new Error(`Role ${role} required`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Decorator to check if user is admin
 */
export function adminOnly(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const context = args[0];
    const userId = context?.userId || context?.user?.id;

    if (!userId) {
      throw new Error('User ID not found in context');
    }

    const { isAdmin } = await import('./helpers');
    const admin = await isAdmin(userId);

    if (!admin) {
      throw new Error('Admin access required');
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Decorator to check resource ownership
 */
export function ownerOnly(
  resourceType: ResourceType,
  resourceIdExtractor: (args: any[]) => string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args[0];
      const userId = context?.userId || context?.user?.id;

      if (!userId) {
        throw new Error('User ID not found in context');
      }

      const resourceId = resourceIdExtractor(args);
      const { isResourceOwner } = await import('./helpers');
      const isOwner = await isResourceOwner(userId, resourceId, resourceType);

      if (!isOwner) {
        throw new Error('Resource owner access required');
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}