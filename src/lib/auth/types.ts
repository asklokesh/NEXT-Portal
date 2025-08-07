// Authentication and authorization types for the Backstage IDP wrapper

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  role: UserRole;
  provider: AuthProvider;
  providerId: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  teams?: UserTeam[];
  services?: UserService[];
  permissions?: string[];
}

export interface UserTeam {
  id: string;
  name: string;
  displayName?: string;
  role: TeamRole;
}

export interface UserService {
  id: string;
  name: string;
  displayName?: string;
}

export type UserRole = 'ADMIN' | 'PLATFORM_ENGINEER' | 'DEVELOPER' | 'VIEWER';
export type TeamRole = 'OWNER' | 'MAINTAINER' | 'MEMBER';
export type AuthProvider = 'backstage' | 'github' | 'google' | 'saml' | 'local' | 'azure-ad' | 'okta';

// Authentication context and session types
export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session?: AuthSession;
}

// Token and JWT types
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface ApiKeyData {
  id: string;
  name: string;
  keyHash: string;
  permissions?: Record<string, any>;
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

// Backstage-specific types
export interface BackstageTokenPayload {
  sub: string; // entityRef like 'user:default/john.doe'
  ent: string[]; // entity references the user belongs to
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string;
  scope?: string;
}

export interface BackstageIdentity {
  type: 'user';
  userEntityRef: string;
  ownershipEntityRefs: string[];
}

export interface BackstageOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  trustedIssuers?: string[];
  requiredScopes?: string[];
}

// Permission and authorization types
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  scope?: Record<string, any>;
}

export interface RolePermission {
  role: UserRole;
  permissions: Permission[];
}

export interface AuthorizationContext {
  userId: string;
  userRole: UserRole;
  teamIds: string[];
  serviceIds?: string[];
  permissions?: string[];
}

export type PermissionResource = 
  | 'catalog'
  | 'template' 
  | 'service'
  | 'deployment'
  | 'monitoring'
  | 'cost'
  | 'team'
  | 'user'
  | 'admin'
  | 'api'
  | 'audit'
  | 'notification'
  | 'integration'
  | 'plugin'
  | 'workflow'
  | 'documentation'
  | 'settings';

export type PermissionAction = 
  | 'create'
  | 'read'
  | 'update' 
  | 'delete'
  | 'execute'
  | 'deploy'
  | 'rollback'
  | 'approve'
  | 'reject'
  | 'configure'
  | 'manage'
  | 'view'
  | 'export'
  | 'import'
  | 'share'
  | 'unshare'
  | 'archive'
  | 'restore'
  | '*'; // Wildcard for all actions

export type PermissionScope = 
  | 'own'     // User owns the resource
  | 'team'    // Resource belongs to user's team
  | 'all'     // All resources
  | 'none';   // No access

// Authentication request/response types
export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  tokens?: TokenPair;
  session?: AuthSession;
  error?: string;
  message?: string;
}

export interface LogoutRequest {
  allSessions?: boolean;
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  username?: string;
  password: string;
  confirmPassword: string;
  inviteCode?: string;
}

export interface ProfileUpdateRequest {
  name?: string;
  username?: string;
  avatar?: string;
  preferences?: Record<string, any>;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// OAuth and provider-specific types
export interface OAuthState {
  timestamp: number;
  origin: string;
  provider: AuthProvider;
  nonce?: string;
}

export interface OAuthCallbackData {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

export interface ProviderUserInfo {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  provider: AuthProvider;
  providerId: string;
  metadata?: Record<string, any>;
}

// Security and audit types
export interface SecurityValidation {
  isExpired: boolean;
  isFromTrustedSource: boolean;
  hasValidSignature: boolean;
  hasRequiredScopes: boolean;
  ipWhitelisted?: boolean;
  deviceTrusted?: boolean;
}

export interface AuthenticationAttempt {
  userId?: string;
  email?: string;
  provider: AuthProvider;
  method: 'password' | 'token' | 'oauth' | 'api_key' | 'session';
  success: boolean;
  failureReason?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SessionActivity {
  sessionId: string;
  userId: string;
  action: string;
  resource?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Middleware and utility types
export interface AuthenticatedRequest {
  user: AuthUser;
  session?: AuthSession;
  permissions?: string[];
}

export interface AuthMiddlewareOptions {
  required?: boolean;
  roles?: UserRole[];
  permissions?: Array<{
    resource: PermissionResource;
    action: PermissionAction;
    scope?: PermissionScope;
  }>;
  rateLimitOverride?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  userMultiplier: number;
  adminMultiplier: number;
  skipSuccessfulAuth?: boolean;
}

// Error types
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string = 'AUTH_FAILED',
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string = 'FORBIDDEN',
    public statusCode: number = 403,
    public requiredPermission?: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED', 401);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = 'Invalid token') {
    super(message, 'INVALID_TOKEN', 401);
    this.name = 'InvalidTokenError';
  }
}

// Configuration types
export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
    audience: string;
  };
  session: {
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  oauth: {
    providers: Partial<Record<AuthProvider, any>>;
  };
  backstage: BackstageOAuthConfig;
  security: {
    passwordMinLength: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    requireEmailVerification: boolean;
    allowSelfRegistration: boolean;
  };
  rateLimit: RateLimitConfig;
}

// Export default permissions for different roles
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Array<{resource: PermissionResource; action: PermissionAction; scope?: PermissionScope}>> = {
  ADMIN: [
    { resource: '*' as PermissionResource, action: '*' }
  ],
  PLATFORM_ENGINEER: [
    { resource: 'catalog', action: '*' },
    { resource: 'template', action: '*' },
    { resource: 'service', action: '*' },
    { resource: 'deployment', action: '*' },
    { resource: 'monitoring', action: '*' },
    { resource: 'cost', action: 'read' },
    { resource: 'team', action: 'manage' },
    { resource: 'user', action: 'read' },
    { resource: 'integration', action: '*' },
    { resource: 'plugin', action: '*' },
  ],
  DEVELOPER: [
    { resource: 'catalog', action: 'read' },
    { resource: 'template', action: 'read' },
    { resource: 'template', action: 'execute' },
    { resource: 'service', action: 'read', scope: 'own' },
    { resource: 'service', action: 'create' },
    { resource: 'service', action: 'update', scope: 'own' },
    { resource: 'deployment', action: 'read', scope: 'own' },
    { resource: 'deployment', action: 'create', scope: 'own' },
    { resource: 'cost', action: 'read', scope: 'own' },
    { resource: 'documentation', action: 'read' },
    { resource: 'documentation', action: 'create' },
    { resource: 'workflow', action: 'execute' },
  ],
  VIEWER: [
    { resource: 'catalog', action: 'read' },
    { resource: 'template', action: 'read' },
    { resource: 'service', action: 'read' },
    { resource: 'deployment', action: 'read' },
    { resource: 'cost', action: 'read' },
    { resource: 'documentation', action: 'read' },
    { resource: 'monitoring', action: 'read' },
  ]
};

export default {
  AuthUser,
  AuthSession,
  JWTPayload,
  Permission,
  AuthConfig,
  DEFAULT_ROLE_PERMISSIONS,
};