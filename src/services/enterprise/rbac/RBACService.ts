/**
 * Role-Based Access Control Service
 * Handles permission checks, role management, and access control
 */

import {
  Permission,
  PermissionScope,
  Role,
  RoleType,
  User,
  Group,
  Policy,
  PolicyRule,
  AccessRequest,
  AccessRequestStatus,
  ApiKey,
  Session,
  PermissionCheck,
  PermissionCheckResult,
  UserPermissions,
  ResourceType,
  Action,
  SYSTEM_ROLES,
  SystemRole,
} from './types';

// ============================================================================
// RBAC Service
// ============================================================================

export class RBACService {
  private roles: Map<string, Role> = new Map();
  private users: Map<string, User> = new Map();
  private groups: Map<string, Group> = new Map();
  private policies: Map<string, Policy> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private sessions: Map<string, Session> = new Map();
  private accessRequests: Map<string, AccessRequest> = new Map();

  constructor() {
    this.initializeSystemRoles();
    this.initializeSampleData();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private initializeSystemRoles(): void {
    Object.entries(SYSTEM_ROLES).forEach(([key, roleConfig]) => {
      const role: Role = {
        ...roleConfig,
        id: key,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.roles.set(key, role);
    });
  }

  private initializeSampleData(): void {
    // Sample users
    const users: User[] = [
      {
        id: 'user-1',
        email: 'admin@company.com',
        displayName: 'Admin User',
        status: 'active',
        roles: [
          { roleId: 'super-admin', grantedAt: new Date().toISOString(), grantedBy: 'system' },
        ],
        groups: ['platform-team'],
        metadata: { department: 'Engineering', title: 'Platform Lead' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'user-2',
        email: 'developer@company.com',
        displayName: 'Jane Developer',
        status: 'active',
        roles: [
          { roleId: 'developer', grantedAt: new Date().toISOString(), grantedBy: 'user-1' },
        ],
        groups: ['backend-team'],
        metadata: { department: 'Engineering', title: 'Senior Developer' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'user-3',
        email: 'viewer@company.com',
        displayName: 'Bob Viewer',
        status: 'active',
        roles: [
          { roleId: 'viewer', grantedAt: new Date().toISOString(), grantedBy: 'user-1' },
        ],
        groups: [],
        metadata: { department: 'Product', title: 'Product Manager' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    users.forEach((user) => this.users.set(user.id, user));

    // Sample groups
    const groups: Group[] = [
      {
        id: 'platform-team',
        name: 'platform-team',
        displayName: 'Platform Team',
        description: 'Core platform engineering team',
        type: 'team',
        roles: [
          { roleId: 'platform-admin', grantedAt: new Date().toISOString(), grantedBy: 'system' },
        ],
        members: [
          { userId: 'user-1', role: 'owner', addedAt: new Date().toISOString(), addedBy: 'system' },
        ],
        metadata: { slack: '#platform-team', costCenter: 'ENG-001' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'backend-team',
        name: 'backend-team',
        displayName: 'Backend Team',
        description: 'Backend services development team',
        type: 'team',
        roles: [
          { roleId: 'developer', grantedAt: new Date().toISOString(), grantedBy: 'system' },
        ],
        members: [
          { userId: 'user-2', role: 'member', addedAt: new Date().toISOString(), addedBy: 'user-1' },
        ],
        metadata: { slack: '#backend-team', costCenter: 'ENG-002' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    groups.forEach((group) => this.groups.set(group.id, group));

    // Sample policies
    const policies: Policy[] = [
      {
        id: 'deny-prod-delete',
        name: 'Deny Production Delete',
        description: 'Prevent deletion of production entities without approval',
        type: 'deny',
        rules: [
          {
            id: 'rule-1',
            subjects: [{ type: 'role', pattern: '*' }],
            resources: [
              {
                type: 'entity',
                attributes: { environment: 'production' },
              },
            ],
            actions: ['delete'],
            conditions: [
              { type: 'approval', operator: 'required', value: true },
            ],
            effect: 'deny',
          },
        ],
        priority: 100,
        enabled: true,
        metadata: { createdBy: 'system' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'require-mfa-admin',
        name: 'Require MFA for Admin Actions',
        description: 'Admin actions require MFA verification',
        type: 'conditional',
        rules: [
          {
            id: 'rule-1',
            subjects: [{ type: 'role', id: 'super-admin' }, { type: 'role', id: 'org-admin' }],
            resources: [{ type: 'settings' }, { type: 'user' }, { type: 'role' }],
            actions: ['manage', 'delete', 'create'],
            conditions: [
              { type: 'mfa', operator: 'eq', value: true },
            ],
            effect: 'allow',
          },
        ],
        priority: 90,
        enabled: true,
        metadata: { createdBy: 'system' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    policies.forEach((policy) => this.policies.set(policy.id, policy));
  }

  // ============================================================================
  // Permission Checking
  // ============================================================================

  async checkPermission(check: PermissionCheck): Promise<PermissionCheckResult> {
    const user = this.users.get(check.userId);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    if (user.status !== 'active') {
      return { allowed: false, reason: `User is ${user.status}` };
    }

    // Get effective permissions
    const permissions = await this.getUserPermissions(check.userId);

    // Check deny policies first (highest priority)
    for (const policy of permissions.policies.filter((p) => p.type === 'deny' && p.enabled)) {
      const denied = this.evaluatePolicy(policy, check, permissions);
      if (denied) {
        return {
          allowed: false,
          reason: 'Denied by policy',
          matchedPolicy: policy.id,
        };
      }
    }

    // Check if user has the required permission
    const hasPermission = permissions.effectivePermissions.some((perm) => {
      // Check resource type match
      if (perm.resource !== check.resource && perm.action !== 'manage') {
        return false;
      }

      // Check action match
      if (perm.action !== check.action && perm.action !== 'manage') {
        return false;
      }

      // Check scope if specified
      if (perm.scope && check.resourceId) {
        if (!this.checkScope(perm.scope, check.resourceId)) {
          return false;
        }
      }

      return true;
    });

    if (hasPermission) {
      // Check conditional policies
      for (const policy of permissions.policies.filter((p) => p.type === 'conditional' && p.enabled)) {
        const conditionMet = this.evaluateConditions(policy, check);
        if (!conditionMet) {
          return {
            allowed: false,
            reason: 'Condition not met',
            matchedPolicy: policy.id,
            conditions: policy.rules.flatMap((r) => r.conditions || []),
          };
        }
      }

      return { allowed: true };
    }

    return { allowed: false, reason: 'Permission not granted' };
  }

  private evaluatePolicy(policy: Policy, check: PermissionCheck, permissions: UserPermissions): boolean {
    for (const rule of policy.rules) {
      // Check if subject matches
      const subjectMatches = rule.subjects.some((subject) => {
        if (subject.type === 'user' && subject.id === check.userId) return true;
        if (subject.type === 'role') {
          return permissions.roles.some((role) =>
            subject.id ? role.id === subject.id : subject.pattern === '*'
          );
        }
        return false;
      });

      if (!subjectMatches) continue;

      // Check if resource matches
      const resourceMatches = rule.resources.some((resource) => {
        if (resource.type !== check.resource) return false;
        if (resource.id && resource.id !== check.resourceId) return false;
        return true;
      });

      if (!resourceMatches) continue;

      // Check if action matches
      if (!rule.actions.includes(check.action)) continue;

      return rule.effect === 'deny';
    }

    return false;
  }

  private evaluateConditions(policy: Policy, check: PermissionCheck): boolean {
    for (const rule of policy.rules) {
      for (const condition of rule.conditions || []) {
        switch (condition.type) {
          case 'mfa':
            if (condition.operator === 'eq' && condition.value === true) {
              if (!check.context?.mfaVerified) return false;
            }
            break;
          case 'ip':
            // IP-based conditions would check against allowed IP ranges
            break;
          case 'time':
            // Time-based conditions would check against allowed time windows
            break;
          case 'approval':
            // Approval conditions would require an approved access request
            break;
        }
      }
    }
    return true;
  }

  private checkScope(scope: PermissionScope, resourceId: string): boolean {
    // In a real implementation, this would check the resource's scope against the permission scope
    return true;
  }

  // ============================================================================
  // User Permissions
  // ============================================================================

  async getUserPermissions(userId: string): Promise<UserPermissions> {
    const user = this.users.get(userId);
    if (!user) {
      return {
        userId,
        roles: [],
        directPermissions: [],
        groupPermissions: [],
        effectivePermissions: [],
        policies: [],
      };
    }

    // Get direct roles
    const directRoles = user.roles
      .map((ur) => this.roles.get(ur.roleId))
      .filter((r): r is Role => r !== undefined);

    // Get direct permissions from roles
    const directPermissions = directRoles.flatMap((role) => role.permissions);

    // Get group permissions
    const groupPermissions: Permission[] = [];
    for (const groupId of user.groups) {
      const group = this.groups.get(groupId);
      if (group) {
        for (const groupRole of group.roles) {
          const role = this.roles.get(groupRole.roleId);
          if (role) {
            groupPermissions.push(...role.permissions);
          }
        }
      }
    }

    // Get inherited permissions from role hierarchy
    const inheritedPermissions: Permission[] = [];
    for (const role of directRoles) {
      if (role.inheritsFrom) {
        for (const parentRoleId of role.inheritsFrom) {
          const parentRole = this.roles.get(parentRoleId);
          if (parentRole) {
            inheritedPermissions.push(...parentRole.permissions);
          }
        }
      }
    }

    // Merge and deduplicate permissions
    const allPermissions = [...directPermissions, ...groupPermissions, ...inheritedPermissions];
    const effectivePermissions = this.deduplicatePermissions(allPermissions);

    // Get applicable policies
    const policies = Array.from(this.policies.values()).filter((policy) =>
      policy.enabled
    );

    return {
      userId,
      roles: directRoles,
      directPermissions,
      groupPermissions,
      effectivePermissions,
      policies,
    };
  }

  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const seen = new Set<string>();
    return permissions.filter((perm) => {
      const key = `${perm.resource}:${perm.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ============================================================================
  // Role Management
  // ============================================================================

  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const newRole: Role = {
      ...role,
      id: `role-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.roles.set(newRole.id, newRole);
    return newRole;
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role | null> {
    const role = this.roles.get(roleId);
    if (!role || role.type === 'system') return null;

    const updated = {
      ...role,
      ...updates,
      id: role.id,
      type: role.type,
      updatedAt: new Date().toISOString(),
    };
    this.roles.set(roleId, updated);
    return updated;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const role = this.roles.get(roleId);
    if (!role || role.type === 'system') return false;

    this.roles.delete(roleId);
    return true;
  }

  async getRole(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  async listRoles(type?: RoleType): Promise<Role[]> {
    const roles = Array.from(this.roles.values());
    if (type) {
      return roles.filter((r) => r.type === type);
    }
    return roles;
  }

  // ============================================================================
  // User Management
  // ============================================================================

  async assignRole(
    userId: string,
    roleId: string,
    grantedBy: string,
    scope?: PermissionScope,
    expiresAt?: string
  ): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    const role = this.roles.get(roleId);
    if (!role) return false;

    // Check if role is already assigned
    if (user.roles.some((r) => r.roleId === roleId)) return false;

    user.roles.push({
      roleId,
      scope,
      grantedAt: new Date().toISOString(),
      grantedBy,
      expiresAt,
    });
    user.updatedAt = new Date().toISOString();

    return true;
  }

  async revokeRole(userId: string, roleId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    const index = user.roles.findIndex((r) => r.roleId === roleId);
    if (index === -1) return false;

    user.roles.splice(index, 1);
    user.updatedAt = new Date().toISOString();

    return true;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // ============================================================================
  // Group Management
  // ============================================================================

  async createGroup(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<Group> {
    const newGroup: Group = {
      ...group,
      id: `group-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.groups.set(newGroup.id, newGroup);
    return newGroup;
  }

  async addUserToGroup(userId: string, groupId: string, addedBy: string): Promise<boolean> {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const user = this.users.get(userId);
    if (!user) return false;

    if (group.members.some((m) => m.userId === userId)) return false;

    group.members.push({
      userId,
      role: 'member',
      addedAt: new Date().toISOString(),
      addedBy,
    });
    group.updatedAt = new Date().toISOString();

    if (!user.groups.includes(groupId)) {
      user.groups.push(groupId);
      user.updatedAt = new Date().toISOString();
    }

    return true;
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<boolean> {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const user = this.users.get(userId);
    if (!user) return false;

    const memberIndex = group.members.findIndex((m) => m.userId === userId);
    if (memberIndex === -1) return false;

    group.members.splice(memberIndex, 1);
    group.updatedAt = new Date().toISOString();

    const groupIndex = user.groups.indexOf(groupId);
    if (groupIndex !== -1) {
      user.groups.splice(groupIndex, 1);
      user.updatedAt = new Date().toISOString();
    }

    return true;
  }

  async getGroup(groupId: string): Promise<Group | null> {
    return this.groups.get(groupId) || null;
  }

  async listGroups(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  // ============================================================================
  // Access Requests
  // ============================================================================

  async createAccessRequest(
    request: Omit<AccessRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<AccessRequest> {
    const newRequest: AccessRequest = {
      ...request,
      id: `ar-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.accessRequests.set(newRequest.id, newRequest);
    return newRequest;
  }

  async approveAccessRequest(
    requestId: string,
    approverId: string,
    comment?: string
  ): Promise<AccessRequest | null> {
    const request = this.accessRequests.get(requestId);
    if (!request || request.status !== 'pending') return null;

    const approver = request.approvers.find((a) => a.userId === approverId);
    if (!approver) return null;

    approver.status = 'approved';
    approver.comment = comment;
    approver.decidedAt = new Date().toISOString();

    // Check if all required approvals are met
    const approvedCount = request.approvers.filter((a) => a.status === 'approved').length;
    if (approvedCount >= 1) {
      request.status = 'approved';
      // Grant the requested access
      if (request.role) {
        await this.assignRole(request.requesterId, request.role, approverId);
      }
    }

    request.updatedAt = new Date().toISOString();
    return request;
  }

  async denyAccessRequest(
    requestId: string,
    approverId: string,
    comment?: string
  ): Promise<AccessRequest | null> {
    const request = this.accessRequests.get(requestId);
    if (!request || request.status !== 'pending') return null;

    const approver = request.approvers.find((a) => a.userId === approverId);
    if (!approver) return null;

    approver.status = 'denied';
    approver.comment = comment;
    approver.decidedAt = new Date().toISOString();

    request.status = 'denied';
    request.updatedAt = new Date().toISOString();

    return request;
  }

  async listAccessRequests(status?: AccessRequestStatus): Promise<AccessRequest[]> {
    const requests = Array.from(this.accessRequests.values());
    if (status) {
      return requests.filter((r) => r.status === status);
    }
    return requests;
  }

  // ============================================================================
  // API Keys
  // ============================================================================

  async createApiKey(
    apiKey: Omit<ApiKey, 'id' | 'keyHash' | 'keyPrefix' | 'createdAt'>
  ): Promise<{ apiKey: ApiKey; secret: string }> {
    const secret = this.generateApiKeySecret();
    const keyPrefix = secret.substring(0, 8);
    const keyHash = await this.hashApiKey(secret);

    const newApiKey: ApiKey = {
      ...apiKey,
      id: `key-${Date.now()}`,
      keyPrefix,
      keyHash,
      createdAt: new Date().toISOString(),
    };
    this.apiKeys.set(newApiKey.id, newApiKey);

    return { apiKey: newApiKey, secret };
  }

  async validateApiKey(key: string): Promise<ApiKey | null> {
    const keyHash = await this.hashApiKey(key);
    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.keyHash === keyHash && apiKey.status === 'active') {
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
          apiKey.status = 'expired';
          return null;
        }
        apiKey.lastUsedAt = new Date().toISOString();
        return apiKey;
      }
    }
    return null;
  }

  private generateApiKeySecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'sk_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async hashApiKey(key: string): Promise<string> {
    // In production, use proper hashing like bcrypt or argon2
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async revokeApiKey(keyId: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) return false;

    apiKey.status = 'revoked';
    return true;
  }

  async listApiKeys(userId?: string): Promise<ApiKey[]> {
    const keys = Array.from(this.apiKeys.values());
    if (userId) {
      return keys.filter((k) => k.userId === userId);
    }
    return keys;
  }

  // ============================================================================
  // Policies
  // ============================================================================

  async createPolicy(policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy> {
    const newPolicy: Policy = {
      ...policy,
      id: `policy-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(newPolicy.id, newPolicy);
    return newPolicy;
  }

  async updatePolicy(policyId: string, updates: Partial<Policy>): Promise<Policy | null> {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    const updated = {
      ...policy,
      ...updates,
      id: policy.id,
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(policyId, updated);
    return updated;
  }

  async deletePolicy(policyId: string): Promise<boolean> {
    return this.policies.delete(policyId);
  }

  async listPolicies(): Promise<Policy[]> {
    return Array.from(this.policies.values());
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let rbacServiceInstance: RBACService | null = null;

export function getRBACService(): RBACService {
  if (!rbacServiceInstance) {
    rbacServiceInstance = new RBACService();
  }
  return rbacServiceInstance;
}
