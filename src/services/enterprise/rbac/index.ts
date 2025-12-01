/**
 * RBAC (Role-Based Access Control) Service
 * Enterprise-grade permission management
 */

export { RBACService, getRBACService } from './RBACService';
export type {
  // Core types
  ResourceType,
  Action,
  Permission,
  PermissionScope,
  PermissionCondition,

  // Role types
  Role,
  RoleType,
  RoleMetadata,
  SystemRole,

  // User types
  User,
  UserStatus,
  UserRole,
  UserMetadata,

  // Group types
  Group,
  GroupType,
  GroupRole,
  GroupMember,
  GroupMetadata,

  // Policy types
  Policy,
  PolicyType,
  PolicyRule,
  PolicySubject,
  PolicyResource,
  PolicyCondition,
  PolicyMetadata,

  // Access request types
  AccessRequest,
  AccessRequestType,
  AccessRequestStatus,
  AccessApprover,
  AccessRequestMetadata,

  // API key types
  ApiKey,
  ApiKeyStatus,
  ApiKeyRateLimit,

  // Session types
  Session,
  SessionStatus,
  SessionLocation,

  // Query types
  PermissionCheck,
  PermissionCheckContext,
  PermissionCheckResult,
  UserPermissions,
} from './types';

export { SYSTEM_ROLES } from './types';
