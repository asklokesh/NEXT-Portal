/**
 * Edge Runtime Compatible Permission Helpers
 * Simplified utility functions for permission checks in Edge Runtime
 */

import { PermissionEngineEdge } from './permission-engine-edge';
import {
  PermissionCheckRequest,
  PermissionDecision,
  ResourceType,
  PermissionAction,
  PermissionContext
} from './types';

/**
 * Check if user has permission (Edge Runtime version)
 */
export async function checkPermission(
  userId: string,
  resource: ResourceType,
  action: PermissionAction,
  resourceId?: string,
  context?: PermissionContext
): Promise<boolean> {
  const engine = PermissionEngineEdge.getInstance();
  
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
 * Check multiple permissions (Edge Runtime version)
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
  const engine = PermissionEngineEdge.getInstance();

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
 * Custom error for permission denied
 */
export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}