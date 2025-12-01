/**
 * SSO (Single Sign-On) Service
 * Enterprise authentication and identity management
 */

export { SSOService, getSSOService } from './SSOService';
export type {
  // Identity provider types
  IdentityProvider,
  IdentityProviderType,
  IdentityProviderStatus,
  IdentityProviderConfig,
  SAMLConfig,
  SAMLNameIdFormat,
  LDAPConfig,
  IdentityProviderMetadata,

  // Attribute mapping types
  AttributeMapping,
  GroupMapping,

  // Session types
  SSOSession,
  SSOSessionStatus,
  AuthMethod,
  SessionTokens,
  DeviceInfo,

  // MFA types
  MFAConfig,
  MFAMethod,
  MFAMethodType,
  MFAMethodConfig,
  UserMFAEnrollment,

  // SCIM types
  SCIMConfig,
  SCIMResourceType,
  SCIMAttributeMapping,
  SCIMSyncJob,

  // Service provider types
  ServiceProviderMetadata,

  // Authentication types
  AuthenticationRequest,
  AuthRequestStatus,
  AuthenticationResponse,

  // Domain verification types
  DomainVerification,
  DomainVerificationStatus,
  DomainVerificationMethod,

  // Event types
  SSOEvent,
} from './types';
