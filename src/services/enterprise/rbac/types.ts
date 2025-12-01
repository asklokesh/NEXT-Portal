/**
 * Role-Based Access Control (RBAC) Types
 * Enterprise-grade permission management
 */

// ============================================================================
// Core Permission Types
// ============================================================================

export type ResourceType =
  | 'catalog'
  | 'entity'
  | 'template'
  | 'action'
  | 'scorecard'
  | 'analytics'
  | 'settings'
  | 'user'
  | 'group'
  | 'role'
  | 'api-key'
  | 'webhook'
  | 'integration'
  | 'audit-log'
  | 'compliance'
  | 'secret'
  | 'environment'
  | 'pipeline';

export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'approve'
  | 'manage'
  | 'export'
  | 'import'
  | 'share'
  | 'assign';

export interface Permission {
  id: string;
  resource: ResourceType;
  action: Action;
  scope?: PermissionScope;
  conditions?: PermissionCondition[];
  description?: string;
}

export interface PermissionScope {
  type: 'global' | 'organization' | 'team' | 'project' | 'entity';
  value?: string; // The specific scope ID if not global
}

export interface PermissionCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'contains' | 'matches';
  value: string | string[];
}

// ============================================================================
// Role Types
// ============================================================================

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: RoleType;
  permissions: Permission[];
  inheritsFrom?: string[]; // Role IDs to inherit from
  metadata: RoleMetadata;
  createdAt: string;
  updatedAt: string;
}

export type RoleType = 'system' | 'custom' | 'team' | 'project';

export interface RoleMetadata {
  createdBy?: string;
  isDefault?: boolean;
  maxUsers?: number;
  expiresAt?: string;
  tags?: string[];
}

// Predefined system roles
export type SystemRole =
  | 'super-admin'
  | 'org-admin'
  | 'platform-admin'
  | 'developer'
  | 'viewer'
  | 'guest';

export const SYSTEM_ROLES: Record<SystemRole, Omit<Role, 'id' | 'createdAt' | 'updatedAt'>> = {
  'super-admin': {
    name: 'super-admin',
    displayName: 'Super Administrator',
    description: 'Full access to all resources and settings',
    type: 'system',
    permissions: [
      { id: 'all', resource: 'catalog', action: 'manage' },
      { id: 'all', resource: 'entity', action: 'manage' },
      { id: 'all', resource: 'template', action: 'manage' },
      { id: 'all', resource: 'action', action: 'manage' },
      { id: 'all', resource: 'scorecard', action: 'manage' },
      { id: 'all', resource: 'analytics', action: 'manage' },
      { id: 'all', resource: 'settings', action: 'manage' },
      { id: 'all', resource: 'user', action: 'manage' },
      { id: 'all', resource: 'group', action: 'manage' },
      { id: 'all', resource: 'role', action: 'manage' },
      { id: 'all', resource: 'api-key', action: 'manage' },
      { id: 'all', resource: 'audit-log', action: 'read' },
      { id: 'all', resource: 'compliance', action: 'manage' },
    ],
    metadata: { isDefault: true },
  },
  'org-admin': {
    name: 'org-admin',
    displayName: 'Organization Administrator',
    description: 'Manage organization settings and users',
    type: 'system',
    permissions: [
      { id: 'org-catalog', resource: 'catalog', action: 'manage', scope: { type: 'organization' } },
      { id: 'org-users', resource: 'user', action: 'manage', scope: { type: 'organization' } },
      { id: 'org-groups', resource: 'group', action: 'manage', scope: { type: 'organization' } },
      { id: 'org-settings', resource: 'settings', action: 'manage', scope: { type: 'organization' } },
      { id: 'org-audit', resource: 'audit-log', action: 'read', scope: { type: 'organization' } },
    ],
    metadata: { isDefault: true },
  },
  'platform-admin': {
    name: 'platform-admin',
    displayName: 'Platform Administrator',
    description: 'Manage platform configuration and integrations',
    type: 'system',
    permissions: [
      { id: 'platform-templates', resource: 'template', action: 'manage' },
      { id: 'platform-actions', resource: 'action', action: 'manage' },
      { id: 'platform-scorecards', resource: 'scorecard', action: 'manage' },
      { id: 'platform-integrations', resource: 'integration', action: 'manage' },
      { id: 'platform-webhooks', resource: 'webhook', action: 'manage' },
    ],
    metadata: { isDefault: true },
  },
  'developer': {
    name: 'developer',
    displayName: 'Developer',
    description: 'Standard developer access to catalog and templates',
    type: 'system',
    permissions: [
      { id: 'dev-catalog-read', resource: 'catalog', action: 'read' },
      { id: 'dev-entity-read', resource: 'entity', action: 'read' },
      { id: 'dev-entity-create', resource: 'entity', action: 'create' },
      { id: 'dev-template-read', resource: 'template', action: 'read' },
      { id: 'dev-template-execute', resource: 'template', action: 'execute' },
      { id: 'dev-action-read', resource: 'action', action: 'read' },
      { id: 'dev-action-execute', resource: 'action', action: 'execute' },
      { id: 'dev-scorecard-read', resource: 'scorecard', action: 'read' },
      { id: 'dev-analytics-read', resource: 'analytics', action: 'read' },
    ],
    metadata: { isDefault: true },
  },
  'viewer': {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to catalog and analytics',
    type: 'system',
    permissions: [
      { id: 'viewer-catalog', resource: 'catalog', action: 'read' },
      { id: 'viewer-entity', resource: 'entity', action: 'read' },
      { id: 'viewer-template', resource: 'template', action: 'read' },
      { id: 'viewer-scorecard', resource: 'scorecard', action: 'read' },
      { id: 'viewer-analytics', resource: 'analytics', action: 'read' },
    ],
    metadata: { isDefault: true },
  },
  'guest': {
    name: 'guest',
    displayName: 'Guest',
    description: 'Limited access for external users',
    type: 'system',
    permissions: [
      { id: 'guest-catalog', resource: 'catalog', action: 'read' },
      { id: 'guest-entity', resource: 'entity', action: 'read' },
    ],
    metadata: { isDefault: true },
  },
};

// ============================================================================
// User and Group Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  status: UserStatus;
  roles: UserRole[];
  groups: string[]; // Group IDs
  metadata: UserMetadata;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface UserRole {
  roleId: string;
  scope?: PermissionScope;
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
}

export interface UserMetadata {
  department?: string;
  title?: string;
  location?: string;
  timezone?: string;
  preferences?: Record<string, any>;
  ssoProvider?: string;
  externalId?: string;
}

export interface Group {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  type: GroupType;
  parentId?: string;
  roles: GroupRole[];
  members: GroupMember[];
  metadata: GroupMetadata;
  createdAt: string;
  updatedAt: string;
}

export type GroupType = 'team' | 'department' | 'project' | 'custom';

export interface GroupRole {
  roleId: string;
  scope?: PermissionScope;
  grantedAt: string;
  grantedBy: string;
}

export interface GroupMember {
  userId: string;
  role?: 'owner' | 'admin' | 'member';
  addedAt: string;
  addedBy: string;
}

export interface GroupMetadata {
  email?: string;
  slack?: string;
  pagerDuty?: string;
  costCenter?: string;
  manager?: string;
}

// ============================================================================
// Policy Types
// ============================================================================

export interface Policy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  rules: PolicyRule[];
  priority: number;
  enabled: boolean;
  metadata: PolicyMetadata;
  createdAt: string;
  updatedAt: string;
}

export type PolicyType = 'allow' | 'deny' | 'conditional';

export interface PolicyRule {
  id: string;
  subjects: PolicySubject[];
  resources: PolicyResource[];
  actions: Action[];
  conditions?: PolicyCondition[];
  effect: 'allow' | 'deny';
}

export interface PolicySubject {
  type: 'user' | 'group' | 'role' | 'service-account';
  id?: string;
  pattern?: string; // For matching patterns like "team:*"
}

export interface PolicyResource {
  type: ResourceType;
  id?: string;
  pattern?: string;
  attributes?: Record<string, string>;
}

export interface PolicyCondition {
  type: 'time' | 'ip' | 'mfa' | 'approval' | 'attribute';
  operator: string;
  value: any;
}

export interface PolicyMetadata {
  createdBy: string;
  tags?: string[];
  version?: number;
}

// ============================================================================
// Access Request Types
// ============================================================================

export interface AccessRequest {
  id: string;
  requesterId: string;
  type: AccessRequestType;
  status: AccessRequestStatus;
  resource: PolicyResource;
  role?: string;
  permissions?: Permission[];
  justification: string;
  duration?: number; // In hours
  approvers: AccessApprover[];
  metadata: AccessRequestMetadata;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export type AccessRequestType = 'role' | 'permission' | 'resource' | 'elevated';

export type AccessRequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'revoked'
  | 'auto-approved';

export interface AccessApprover {
  userId: string;
  status: 'pending' | 'approved' | 'denied';
  comment?: string;
  decidedAt?: string;
}

export interface AccessRequestMetadata {
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  ticketId?: string;
  workflowId?: string;
}

// ============================================================================
// API Key Types
// ============================================================================

export interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string; // First 8 chars for identification
  keyHash: string;
  userId: string;
  permissions: Permission[];
  scopes: string[];
  rateLimit?: ApiKeyRateLimit;
  status: ApiKeyStatus;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export type ApiKeyStatus = 'active' | 'inactive' | 'expired' | 'revoked';

export interface ApiKeyRateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  userId: string;
  status: SessionStatus;
  ipAddress: string;
  userAgent: string;
  location?: SessionLocation;
  mfaVerified: boolean;
  permissions: Permission[]; // Resolved permissions for the session
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

export type SessionStatus = 'active' | 'expired' | 'revoked';

export interface SessionLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// RBAC Query Types
// ============================================================================

export interface PermissionCheck {
  userId: string;
  resource: ResourceType;
  resourceId?: string;
  action: Action;
  context?: PermissionCheckContext;
}

export interface PermissionCheckContext {
  ipAddress?: string;
  userAgent?: string;
  mfaVerified?: boolean;
  attributes?: Record<string, any>;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedPolicy?: string;
  matchedRole?: string;
  conditions?: PolicyCondition[];
}

export interface UserPermissions {
  userId: string;
  roles: Role[];
  directPermissions: Permission[];
  groupPermissions: Permission[];
  effectivePermissions: Permission[];
  policies: Policy[];
}
