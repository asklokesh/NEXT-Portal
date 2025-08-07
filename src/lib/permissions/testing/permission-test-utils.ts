/**
 * Permission Testing Utilities
 * Helper functions for testing permission scenarios
 */

import { 
  Role, 
  Permission, 
  UserWithPermissions,
  ResourceType,
  PermissionAction,
  PermissionCheckRequest,
  PermissionDecision,
  SystemRoles
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a mock user with specific roles
 */
export function createMockUser(
  roles: Role[] = [],
  permissions: Permission[] = []
): UserWithPermissions {
  return {
    id: uuidv4(),
    email: 'test@example.com',
    name: 'Test User',
    roles,
    permissions,
    attributes: {
      department: 'engineering',
      team: 'platform',
      clearanceLevel: 2
    },
    createdAt: new Date(),
    updatedAt: new Date()
  } as UserWithPermissions;
}

/**
 * Create a mock admin user
 */
export function createMockAdmin(): UserWithPermissions {
  const adminRole = createMockRole(
    SystemRoles.ADMIN,
    'Administrator',
    generateAllPermissions()
  );
  return createMockUser([adminRole]);
}

/**
 * Create a mock developer user
 */
export function createMockDeveloper(): UserWithPermissions {
  const developerRole = createMockRole(
    SystemRoles.DEVELOPER,
    'Developer',
    generateDeveloperPermissions()
  );
  return createMockUser([developerRole]);
}

/**
 * Create a mock viewer user
 */
export function createMockViewer(): UserWithPermissions {
  const viewerRole = createMockRole(
    SystemRoles.VIEWER,
    'Viewer',
    generateViewerPermissions()
  );
  return createMockUser([viewerRole]);
}

/**
 * Create a mock role
 */
export function createMockRole(
  id: string,
  name: string,
  permissions: Permission[] = []
): Role {
  return {
    id,
    name,
    description: `${name} role`,
    permissions,
    isSystem: true,
    isCustom: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Create a mock permission
 */
export function createMockPermission(
  resource: ResourceType,
  action: PermissionAction
): Permission {
  return {
    id: `perm-${resource}-${action}`,
    resource,
    action,
    scope: { type: 'global' }
  };
}

/**
 * Generate all permissions
 */
export function generateAllPermissions(): Permission[] {
  const permissions: Permission[] = [];
  const resources = Object.values(ResourceType);
  const actions = Object.values(PermissionAction);

  for (const resource of resources) {
    for (const action of actions) {
      permissions.push(createMockPermission(resource, action));
    }
  }

  return permissions;
}

/**
 * Generate developer permissions
 */
export function generateDeveloperPermissions(): Permission[] {
  return [
    createMockPermission(ResourceType.CATALOG, PermissionAction.CREATE),
    createMockPermission(ResourceType.CATALOG, PermissionAction.READ),
    createMockPermission(ResourceType.CATALOG, PermissionAction.UPDATE),
    createMockPermission(ResourceType.ENTITY, PermissionAction.CREATE),
    createMockPermission(ResourceType.ENTITY, PermissionAction.READ),
    createMockPermission(ResourceType.ENTITY, PermissionAction.UPDATE),
    createMockPermission(ResourceType.TEMPLATE, PermissionAction.READ),
    createMockPermission(ResourceType.TEMPLATE, PermissionAction.EXECUTE),
    createMockPermission(ResourceType.PLUGIN, PermissionAction.READ),
    createMockPermission(ResourceType.DOCUMENTATION, PermissionAction.CREATE),
    createMockPermission(ResourceType.DOCUMENTATION, PermissionAction.READ),
    createMockPermission(ResourceType.DOCUMENTATION, PermissionAction.UPDATE),
    createMockPermission(ResourceType.MONITORING, PermissionAction.READ),
    createMockPermission(ResourceType.DEPLOYMENT, PermissionAction.READ)
  ];
}

/**
 * Generate viewer permissions
 */
export function generateViewerPermissions(): Permission[] {
  const readableResources = [
    ResourceType.CATALOG,
    ResourceType.ENTITY,
    ResourceType.TEMPLATE,
    ResourceType.PLUGIN,
    ResourceType.DOCUMENTATION,
    ResourceType.MONITORING,
    ResourceType.DEPLOYMENT
  ];

  return readableResources.map(resource =>
    createMockPermission(resource, PermissionAction.READ)
  );
}

/**
 * Create a permission check request
 */
export function createPermissionRequest(
  userId: string,
  resource: ResourceType,
  action: PermissionAction,
  resourceId?: string
): PermissionCheckRequest {
  return {
    userId,
    resource,
    action,
    resourceId,
    context: {
      requestMetadata: {
        timestamp: new Date().toISOString(),
        hour: new Date().getHours()
      }
    }
  };
}

/**
 * Assert permission is allowed
 */
export function assertAllowed(decision: PermissionDecision): void {
  if (!decision.allowed) {
    throw new Error(`Expected permission to be allowed but was denied: ${decision.reason}`);
  }
}

/**
 * Assert permission is denied
 */
export function assertDenied(decision: PermissionDecision): void {
  if (decision.allowed) {
    throw new Error(`Expected permission to be denied but was allowed: ${decision.reason}`);
  }
}

/**
 * Test permission scenarios
 */
export class PermissionTestScenarios {
  /**
   * Test admin can do everything
   */
  static adminFullAccess(): Array<{
    resource: ResourceType;
    action: PermissionAction;
    expected: boolean;
  }> {
    const scenarios = [];
    for (const resource of Object.values(ResourceType)) {
      for (const action of Object.values(PermissionAction)) {
        scenarios.push({
          resource,
          action,
          expected: true
        });
      }
    }
    return scenarios;
  }

  /**
   * Test developer permissions
   */
  static developerPermissions(): Array<{
    resource: ResourceType;
    action: PermissionAction;
    expected: boolean;
  }> {
    return [
      { resource: ResourceType.CATALOG, action: PermissionAction.READ, expected: true },
      { resource: ResourceType.CATALOG, action: PermissionAction.CREATE, expected: true },
      { resource: ResourceType.CATALOG, action: PermissionAction.UPDATE, expected: true },
      { resource: ResourceType.CATALOG, action: PermissionAction.DELETE, expected: false },
      { resource: ResourceType.SETTINGS, action: PermissionAction.UPDATE, expected: false },
      { resource: ResourceType.ROLE, action: PermissionAction.CREATE, expected: false },
      { resource: ResourceType.AUDIT, action: PermissionAction.DELETE, expected: false }
    ];
  }

  /**
   * Test viewer permissions
   */
  static viewerPermissions(): Array<{
    resource: ResourceType;
    action: PermissionAction;
    expected: boolean;
  }> {
    return [
      { resource: ResourceType.CATALOG, action: PermissionAction.READ, expected: true },
      { resource: ResourceType.CATALOG, action: PermissionAction.CREATE, expected: false },
      { resource: ResourceType.CATALOG, action: PermissionAction.UPDATE, expected: false },
      { resource: ResourceType.CATALOG, action: PermissionAction.DELETE, expected: false },
      { resource: ResourceType.ENTITY, action: PermissionAction.READ, expected: true },
      { resource: ResourceType.ENTITY, action: PermissionAction.CREATE, expected: false },
      { resource: ResourceType.SETTINGS, action: PermissionAction.READ, expected: false }
    ];
  }

  /**
   * Test ownership scenarios
   */
  static ownershipScenarios(): Array<{
    description: string;
    userId: string;
    resourceOwnerId: string;
    resource: ResourceType;
    action: PermissionAction;
    expected: boolean;
  }> {
    const userId = 'user-123';
    const otherId = 'user-456';

    return [
      {
        description: 'Owner can update their own resource',
        userId,
        resourceOwnerId: userId,
        resource: ResourceType.ENTITY,
        action: PermissionAction.UPDATE,
        expected: true
      },
      {
        description: 'Owner can delete their own resource',
        userId,
        resourceOwnerId: userId,
        resource: ResourceType.ENTITY,
        action: PermissionAction.DELETE,
        expected: true
      },
      {
        description: 'Non-owner cannot update resource',
        userId,
        resourceOwnerId: otherId,
        resource: ResourceType.ENTITY,
        action: PermissionAction.UPDATE,
        expected: false
      },
      {
        description: 'Non-owner cannot delete resource',
        userId,
        resourceOwnerId: otherId,
        resource: ResourceType.ENTITY,
        action: PermissionAction.DELETE,
        expected: false
      }
    ];
  }
}

/**
 * Mock permission engine for testing
 */
export class MockPermissionEngine {
  private userPermissions: Map<string, Set<string>>;

  constructor() {
    this.userPermissions = new Map();
  }

  /**
   * Grant permission to user
   */
  grantPermission(
    userId: string,
    resource: ResourceType,
    action: PermissionAction
  ): void {
    const key = `${resource}:${action}`;
    if (!this.userPermissions.has(userId)) {
      this.userPermissions.set(userId, new Set());
    }
    this.userPermissions.get(userId)!.add(key);
  }

  /**
   * Revoke permission from user
   */
  revokePermission(
    userId: string,
    resource: ResourceType,
    action: PermissionAction
  ): void {
    const key = `${resource}:${action}`;
    this.userPermissions.get(userId)?.delete(key);
  }

  /**
   * Check permission
   */
  checkPermission(
    request: PermissionCheckRequest
  ): PermissionDecision {
    const key = `${request.resource}:${request.action}`;
    const userPerms = this.userPermissions.get(request.userId);
    const allowed = userPerms?.has(key) || false;

    return {
      allowed,
      reason: allowed
        ? `User has ${request.action} permission on ${request.resource}`
        : `User lacks ${request.action} permission on ${request.resource}`
    };
  }

  /**
   * Clear all permissions
   */
  clear(): void {
    this.userPermissions.clear();
  }
}