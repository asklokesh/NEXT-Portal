/**
 * SSO (Single Sign-On) Types
 * Enterprise authentication and identity provider integration
 */

// ============================================================================
// Identity Provider Types
// ============================================================================

export interface IdentityProvider {
  id: string;
  name: string;
  displayName: string;
  type: IdentityProviderType;
  status: IdentityProviderStatus;
  config: IdentityProviderConfig;
  attributeMapping: AttributeMapping;
  groupMapping?: GroupMapping[];
  metadata: IdentityProviderMetadata;
  createdAt: string;
  updatedAt: string;
}

export type IdentityProviderType =
  | 'saml'
  | 'oidc'
  | 'oauth2'
  | 'ldap'
  | 'azure-ad'
  | 'okta'
  | 'google-workspace'
  | 'onelogin'
  | 'ping-identity'
  | 'auth0';

export type IdentityProviderStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'error'
  | 'maintenance';

export interface IdentityProviderConfig {
  // Common settings
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUrl?: string;
  scopes?: string[];

  // SAML specific
  saml?: SAMLConfig;

  // LDAP specific
  ldap?: LDAPConfig;

  // Provider-specific settings
  providerSettings?: Record<string, any>;
}

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  signatureAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512';
  digestAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512';
  signAuthnRequest?: boolean;
  wantAssertionsSigned?: boolean;
  wantResponseSigned?: boolean;
  nameIdFormat?: SAMLNameIdFormat;
  requestBinding?: 'HTTP-POST' | 'HTTP-Redirect';
  responseBinding?: 'HTTP-POST' | 'HTTP-Redirect';
  authnContextClassRef?: string;
  forceAuthn?: boolean;
  passiveAuthn?: boolean;
}

export type SAMLNameIdFormat =
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
  | 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
  | 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient';

export interface LDAPConfig {
  url: string;
  baseDn: string;
  bindDn?: string;
  bindPassword?: string;
  userSearchBase?: string;
  userSearchFilter?: string;
  groupSearchBase?: string;
  groupSearchFilter?: string;
  usernameAttribute?: string;
  emailAttribute?: string;
  displayNameAttribute?: string;
  groupMemberAttribute?: string;
  tlsEnabled?: boolean;
  tlsCertificate?: string;
  connectionTimeout?: number;
  searchTimeout?: number;
}

// ============================================================================
// Attribute and Group Mapping
// ============================================================================

export interface AttributeMapping {
  // Standard attributes
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatarUrl?: string;
  department?: string;
  title?: string;
  phone?: string;
  location?: string;

  // Custom attributes
  custom?: Record<string, string>;
}

export interface GroupMapping {
  id: string;
  idpGroup: string;
  portalGroup: string;
  portalRoles?: string[];
  autoSync: boolean;
  syncDirection: 'idp_to_portal' | 'portal_to_idp' | 'bidirectional';
}

// ============================================================================
// Authentication Session Types
// ============================================================================

export interface SSOSession {
  id: string;
  userId: string;
  identityProviderId: string;
  idpSessionId?: string;
  status: SSOSessionStatus;
  authMethod: AuthMethod;
  mfaVerified: boolean;
  attributes: Record<string, any>;
  tokens: SessionTokens;
  device: DeviceInfo;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

export type SSOSessionStatus =
  | 'active'
  | 'expired'
  | 'revoked'
  | 'logged_out'
  | 'idle_timeout';

export type AuthMethod =
  | 'password'
  | 'saml'
  | 'oidc'
  | 'oauth2'
  | 'ldap'
  | 'api_key'
  | 'service_account'
  | 'magic_link'
  | 'passkey';

export interface SessionTokens {
  accessToken?: string;
  accessTokenExpiresAt?: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  idToken?: string;
}

export interface DeviceInfo {
  id: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os?: string;
  browser?: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  trusted?: boolean;
}

// ============================================================================
// MFA Types
// ============================================================================

export interface MFAConfig {
  enabled: boolean;
  required: boolean;
  methods: MFAMethod[];
  gracePeriod?: number; // Days before MFA is required for new users
  trustedDeviceDuration?: number; // Days a device stays trusted
  bypassGroups?: string[]; // Groups that can bypass MFA
  enforceForRoles?: string[]; // Roles that must use MFA
}

export interface MFAMethod {
  type: MFAMethodType;
  enabled: boolean;
  primary?: boolean;
  config?: MFAMethodConfig;
}

export type MFAMethodType =
  | 'totp'
  | 'sms'
  | 'email'
  | 'webauthn'
  | 'push'
  | 'backup_codes'
  | 'hardware_key';

export interface MFAMethodConfig {
  // TOTP config
  totpIssuer?: string;
  totpDigits?: 6 | 8;
  totpPeriod?: number;
  totpAlgorithm?: 'SHA1' | 'SHA256' | 'SHA512';

  // SMS config
  smsProvider?: string;
  smsTemplate?: string;

  // Email config
  emailTemplate?: string;

  // Push config
  pushProvider?: string;
  pushTimeout?: number;

  // WebAuthn config
  rpId?: string;
  rpName?: string;
  attestation?: 'none' | 'indirect' | 'direct';
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

export interface UserMFAEnrollment {
  userId: string;
  method: MFAMethodType;
  status: 'pending' | 'active' | 'disabled';
  secret?: string; // Encrypted
  phoneNumber?: string;
  email?: string;
  deviceId?: string;
  backupCodes?: string[]; // Encrypted
  createdAt: string;
  lastUsedAt?: string;
}

// ============================================================================
// SCIM Provisioning Types
// ============================================================================

export interface SCIMConfig {
  enabled: boolean;
  endpoint: string;
  bearerToken: string;
  supportedResources: SCIMResourceType[];
  attributeMapping: SCIMAttributeMapping;
  groupProvisioning: boolean;
  userProvisioning: boolean;
  deprovisionAction: 'disable' | 'delete' | 'suspend';
}

export type SCIMResourceType = 'User' | 'Group' | 'EnterpriseUser';

export interface SCIMAttributeMapping {
  user: Record<string, string>;
  group: Record<string, string>;
}

export interface SCIMSyncJob {
  id: string;
  identityProviderId: string;
  type: 'full' | 'incremental';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  stats: {
    usersCreated: number;
    usersUpdated: number;
    usersDeleted: number;
    groupsCreated: number;
    groupsUpdated: number;
    groupsDeleted: number;
    errors: number;
  };
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ============================================================================
// Identity Provider Metadata
// ============================================================================

export interface IdentityProviderMetadata {
  createdBy: string;
  domains?: string[]; // Verified domains for this IdP
  defaultRoles?: string[];
  jitProvisioning?: boolean; // Just-in-time user provisioning
  autoJoinGroups?: string[];
  sessionDuration?: number; // Minutes
  maxConcurrentSessions?: number;
  allowedIpRanges?: string[];
  mfaRequired?: boolean;
  tags?: string[];
}

// ============================================================================
// Service Provider Metadata (Our Application)
// ============================================================================

export interface ServiceProviderMetadata {
  entityId: string;
  acsUrl: string;
  sloUrl?: string;
  certificate: string;
  privateKey?: string;
  nameIdFormat: SAMLNameIdFormat;
  signAuthnRequests: boolean;
  wantAssertionsSigned: boolean;
  wantResponseSigned: boolean;
  supportedBindings: ('HTTP-POST' | 'HTTP-Redirect')[];
}

// ============================================================================
// Authentication Flow Types
// ============================================================================

export interface AuthenticationRequest {
  id: string;
  identityProviderId: string;
  type: AuthMethod;
  status: AuthRequestStatus;
  returnUrl?: string;
  relayState?: string;
  nonce?: string;
  codeVerifier?: string;
  codeChallenge?: string;
  createdAt: string;
  expiresAt: string;
}

export type AuthRequestStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface AuthenticationResponse {
  success: boolean;
  userId?: string;
  session?: SSOSession;
  user?: {
    id: string;
    email: string;
    displayName: string;
    attributes: Record<string, any>;
  };
  requiresMfa?: boolean;
  mfaMethods?: MFAMethodType[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// ============================================================================
// Domain Verification Types
// ============================================================================

export interface DomainVerification {
  id: string;
  domain: string;
  identityProviderId: string;
  status: DomainVerificationStatus;
  method: DomainVerificationMethod;
  verificationToken: string;
  dnsRecord?: {
    type: 'TXT' | 'CNAME';
    name: string;
    value: string;
  };
  verifiedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export type DomainVerificationStatus =
  | 'pending'
  | 'verified'
  | 'failed'
  | 'expired';

export type DomainVerificationMethod =
  | 'dns_txt'
  | 'dns_cname'
  | 'http_file'
  | 'email';

// ============================================================================
// SSO Event Types
// ============================================================================

export type SSOEvent =
  | { type: 'login_initiated'; identityProviderId: string; userId?: string }
  | { type: 'login_completed'; userId: string; sessionId: string }
  | { type: 'login_failed'; error: string; identityProviderId: string }
  | { type: 'logout_initiated'; userId: string; sessionId: string }
  | { type: 'logout_completed'; userId: string }
  | { type: 'session_expired'; userId: string; sessionId: string }
  | { type: 'mfa_required'; userId: string; methods: MFAMethodType[] }
  | { type: 'mfa_completed'; userId: string; method: MFAMethodType }
  | { type: 'mfa_failed'; userId: string; method: MFAMethodType }
  | { type: 'user_provisioned'; userId: string; identityProviderId: string }
  | { type: 'user_deprovisioned'; userId: string; identityProviderId: string }
  | { type: 'group_synced'; groupId: string; identityProviderId: string };
