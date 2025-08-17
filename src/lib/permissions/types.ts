/**
 * RBAC Permission Framework Types
 * Complete type definitions for role-based access control
 */

import { User } from '@prisma/client';

// Permission Levels
export enum PermissionLevel {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

// Resource Types
export enum ResourceType {
  CATALOG = 'catalog',
  ENTITY = 'entity',
  TEMPLATE = 'template',
  PLUGIN = 'plugin',
  USER = 'user',
  ROLE = 'role',
  AUDIT = 'audit',
  SETTINGS = 'settings',
  INTEGRATION = 'integration',
  WORKFLOW = 'workflow',
  DOCUMENTATION = 'documentation',
  NOTIFICATION = 'notification',
  COST = 'cost',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring'
}

// Permission Actions
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  APPROVE = 'approve',
  PUBLISH = 'publish',
  EXPORT = 'export',
  IMPORT = 'import',
  MANAGE = 'manage'
}

// Permission Rule
export interface PermissionRule {
  id: string;
  name: string;
  description: string;
  resource: ResourceType;
  action: PermissionAction;
  conditions?: PermissionCondition[];
  effect: 'allow' | 'deny';
  priority: number;
}

// Permission Condition for ABAC
export interface PermissionCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'nin';
  value: any;
}

// Role Definition
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isCustom: boolean;
  inheritedRoles?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Permission Definition
export interface Permission {
  id: string;
  resource: ResourceType;
  action: PermissionAction;
  conditions?: PermissionCondition[];
  scope?: PermissionScope;
}

// Permission Scope
export interface PermissionScope {
  type: 'global' | 'organization' | 'team' | 'project' | 'self';
  entityId?: string;
  attributes?: Record<string, any>;
}

// User with Permissions
export interface UserWithPermissions extends User {
  roles: Role[];
  permissions: Permission[];
  attributes?: UserAttributes;
}

// User Attributes for ABAC
export interface UserAttributes {
  department?: string;
  team?: string;
  location?: string;
  clearanceLevel?: number;
  projects?: string[];
  customAttributes?: Record<string, any>;
}

// Permission Check Request
export interface PermissionCheckRequest {
  userId: string;
  resource: ResourceType;
  action: PermissionAction;
  resourceId?: string;
  context?: PermissionContext;
}

// Permission Context
export interface PermissionContext {
  organizationId?: string;
  teamId?: string;
  projectId?: string;
  entityOwner?: string;
  entityMetadata?: Record<string, any>;
  requestMetadata?: Record<string, any>;
  roles?: string[]; // Added for Edge Runtime permission checks
}

// Permission Decision
export interface PermissionDecision {
  allowed: boolean;
  reason?: string;
  appliedRules?: PermissionRule[];
  deniedBy?: PermissionRule;
  allowedBy?: PermissionRule;
  evaluationTime?: number;
}

// Audit Log Entry
export interface PermissionAuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: ResourceType;
  resourceId?: string;
  decision: PermissionDecision;
  context?: PermissionContext;
  ipAddress?: string;
  userAgent?: string;
}

// Role Assignment
export interface RoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  scope?: PermissionScope;
}

// Permission Policy
export interface PermissionPolicy {
  id: string;
  name: string;
  description: string;
  rules: PermissionRule[];
  version: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Permission Cache Entry
export interface PermissionCacheEntry {
  key: string;
  decision: PermissionDecision;
  expiresAt: Date;
}

// Default System Roles
export const SystemRoles = {
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
  OWNER: 'owner',
  GUEST: 'guest'
} as const;

export type SystemRole = typeof SystemRoles[keyof typeof SystemRoles];

// Permission Evaluation Result
export interface PermissionEvaluationResult {
  decision: PermissionDecision;
  evaluatedRules: PermissionRule[];
  userRoles: Role[];
  effectivePermissions: Permission[];
  cacheable: boolean;
  ttl?: number;
}