/**
 * SSO (Single Sign-On) Service
 * Enterprise authentication and identity provider management
 */

import {
  IdentityProvider,
  IdentityProviderType,
  IdentityProviderStatus,
  IdentityProviderConfig,
  AttributeMapping,
  GroupMapping,
  SSOSession,
  SSOSessionStatus,
  AuthMethod,
  MFAConfig,
  MFAMethod,
  MFAMethodType,
  UserMFAEnrollment,
  SCIMConfig,
  SCIMSyncJob,
  ServiceProviderMetadata,
  AuthenticationRequest,
  AuthenticationResponse,
  DomainVerification,
  SSOEvent,
} from './types';

// ============================================================================
// SSO Service
// ============================================================================

export class SSOService {
  private identityProviders: Map<string, IdentityProvider> = new Map();
  private sessions: Map<string, SSOSession> = new Map();
  private authRequests: Map<string, AuthenticationRequest> = new Map();
  private mfaEnrollments: Map<string, UserMFAEnrollment[]> = new Map();
  private domainVerifications: Map<string, DomainVerification> = new Map();
  private scimJobs: Map<string, SCIMSyncJob> = new Map();

  private serviceProviderMetadata: ServiceProviderMetadata;
  private mfaConfig: MFAConfig;

  constructor() {
    this.serviceProviderMetadata = this.initializeServiceProvider();
    this.mfaConfig = this.initializeMFAConfig();
    this.initializeSampleData();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private initializeServiceProvider(): ServiceProviderMetadata {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return {
      entityId: `${baseUrl}/api/auth/saml/metadata`,
      acsUrl: `${baseUrl}/api/auth/saml/acs`,
      sloUrl: `${baseUrl}/api/auth/saml/slo`,
      certificate: process.env.SAML_SP_CERTIFICATE || '',
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      signAuthnRequests: true,
      wantAssertionsSigned: true,
      wantResponseSigned: true,
      supportedBindings: ['HTTP-POST', 'HTTP-Redirect'],
    };
  }

  private initializeMFAConfig(): MFAConfig {
    return {
      enabled: true,
      required: false,
      methods: [
        { type: 'totp', enabled: true, primary: true },
        { type: 'webauthn', enabled: true },
        { type: 'backup_codes', enabled: true },
        { type: 'email', enabled: false },
        { type: 'sms', enabled: false },
      ],
      gracePeriod: 7,
      trustedDeviceDuration: 30,
      enforceForRoles: ['super-admin', 'org-admin'],
    };
  }

  private initializeSampleData(): void {
    // Sample Okta IdP
    const oktaIdp: IdentityProvider = {
      id: 'idp-okta',
      name: 'okta-production',
      displayName: 'Okta SSO',
      type: 'okta',
      status: 'active',
      config: {
        clientId: 'okta-client-id',
        issuer: 'https://company.okta.com',
        authorizationUrl: 'https://company.okta.com/oauth2/v1/authorize',
        tokenUrl: 'https://company.okta.com/oauth2/v1/token',
        userInfoUrl: 'https://company.okta.com/oauth2/v1/userinfo',
        scopes: ['openid', 'profile', 'email', 'groups'],
      },
      attributeMapping: {
        email: 'email',
        displayName: 'name',
        firstName: 'given_name',
        lastName: 'family_name',
      },
      groupMapping: [
        {
          id: 'gm-1',
          idpGroup: 'Engineering',
          portalGroup: 'engineering-team',
          portalRoles: ['developer'],
          autoSync: true,
          syncDirection: 'idp_to_portal',
        },
        {
          id: 'gm-2',
          idpGroup: 'Platform',
          portalGroup: 'platform-team',
          portalRoles: ['platform-admin'],
          autoSync: true,
          syncDirection: 'idp_to_portal',
        },
      ],
      metadata: {
        createdBy: 'system',
        domains: ['company.com'],
        jitProvisioning: true,
        defaultRoles: ['viewer'],
        sessionDuration: 480,
        maxConcurrentSessions: 5,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.identityProviders.set(oktaIdp.id, oktaIdp);

    // Sample SAML IdP
    const samlIdp: IdentityProvider = {
      id: 'idp-saml',
      name: 'corporate-saml',
      displayName: 'Corporate SAML SSO',
      type: 'saml',
      status: 'active',
      config: {
        saml: {
          entityId: 'https://idp.company.com/saml/metadata',
          ssoUrl: 'https://idp.company.com/saml/sso',
          sloUrl: 'https://idp.company.com/saml/slo',
          certificate: 'MIIC...',
          signatureAlgorithm: 'SHA-256',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          signAuthnRequest: true,
          wantAssertionsSigned: true,
        },
      },
      attributeMapping: {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        department: 'http://schemas.company.com/claims/department',
      },
      metadata: {
        createdBy: 'admin',
        domains: ['company.com', 'subsidiary.com'],
        jitProvisioning: true,
        defaultRoles: ['developer'],
        mfaRequired: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.identityProviders.set(samlIdp.id, samlIdp);
  }

  // ============================================================================
  // Identity Provider Management
  // ============================================================================

  async createIdentityProvider(
    idp: Omit<IdentityProvider, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IdentityProvider> {
    const newIdp: IdentityProvider = {
      ...idp,
      id: `idp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.identityProviders.set(newIdp.id, newIdp);
    return newIdp;
  }

  async updateIdentityProvider(
    idpId: string,
    updates: Partial<IdentityProvider>
  ): Promise<IdentityProvider | null> {
    const idp = this.identityProviders.get(idpId);
    if (!idp) return null;

    const updated = {
      ...idp,
      ...updates,
      id: idp.id,
      updatedAt: new Date().toISOString(),
    };

    this.identityProviders.set(idpId, updated);
    return updated;
  }

  async deleteIdentityProvider(idpId: string): Promise<boolean> {
    return this.identityProviders.delete(idpId);
  }

  async getIdentityProvider(idpId: string): Promise<IdentityProvider | null> {
    return this.identityProviders.get(idpId) || null;
  }

  async listIdentityProviders(status?: IdentityProviderStatus): Promise<IdentityProvider[]> {
    const idps = Array.from(this.identityProviders.values());
    if (status) {
      return idps.filter(idp => idp.status === status);
    }
    return idps;
  }

  async getIdentityProviderByDomain(domain: string): Promise<IdentityProvider | null> {
    for (const idp of this.identityProviders.values()) {
      if (idp.metadata.domains?.includes(domain)) {
        return idp;
      }
    }
    return null;
  }

  // ============================================================================
  // Authentication Flow
  // ============================================================================

  async initiateLogin(
    identityProviderId: string,
    returnUrl?: string
  ): Promise<{ authUrl: string; requestId: string }> {
    const idp = this.identityProviders.get(identityProviderId);
    if (!idp || idp.status !== 'active') {
      throw new Error('Identity provider not found or inactive');
    }

    const request: AuthenticationRequest = {
      id: `auth-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      identityProviderId,
      type: this.getAuthMethodForIdp(idp.type),
      status: 'pending',
      returnUrl,
      relayState: this.generateRelayState(),
      nonce: this.generateNonce(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    };

    // For OIDC/OAuth2, generate PKCE challenge
    if (idp.type === 'oidc' || idp.type === 'oauth2') {
      request.codeVerifier = this.generateCodeVerifier();
      request.codeChallenge = await this.generateCodeChallenge(request.codeVerifier);
    }

    this.authRequests.set(request.id, request);

    const authUrl = this.buildAuthUrl(idp, request);
    return { authUrl, requestId: request.id };
  }

  async handleCallback(
    requestId: string,
    params: Record<string, string>
  ): Promise<AuthenticationResponse> {
    const request = this.authRequests.get(requestId);
    if (!request) {
      return {
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Authentication request not found' },
      };
    }

    if (new Date(request.expiresAt) < new Date()) {
      request.status = 'expired';
      return {
        success: false,
        error: { code: 'REQUEST_EXPIRED', message: 'Authentication request expired' },
      };
    }

    const idp = this.identityProviders.get(request.identityProviderId);
    if (!idp) {
      return {
        success: false,
        error: { code: 'IDP_NOT_FOUND', message: 'Identity provider not found' },
      };
    }

    try {
      // Validate response based on IdP type
      const userInfo = await this.validateAuthResponse(idp, request, params);

      // Check if MFA is required
      const mfaRequired = this.checkMFARequirement(userInfo.id, idp);
      if (mfaRequired) {
        const enrollments = this.mfaEnrollments.get(userInfo.id) || [];
        const activeMethods = enrollments
          .filter(e => e.status === 'active')
          .map(e => e.method);

        if (activeMethods.length === 0) {
          // User needs to enroll in MFA
          return {
            success: false,
            requiresMfa: true,
            mfaMethods: this.mfaConfig.methods
              .filter(m => m.enabled)
              .map(m => m.type),
            userId: userInfo.id,
          };
        }

        return {
          success: false,
          requiresMfa: true,
          mfaMethods: activeMethods,
          userId: userInfo.id,
        };
      }

      // Create session
      const session = await this.createSession(userInfo, idp, params);

      request.status = 'completed';
      return {
        success: true,
        userId: userInfo.id,
        session,
        user: userInfo,
      };
    } catch (error) {
      request.status = 'failed';
      return {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: error instanceof Error ? error.message : 'Authentication failed',
        },
      };
    }
  }

  async verifyMFA(
    userId: string,
    method: MFAMethodType,
    code: string,
    deviceInfo?: Partial<SSOSession['device']>
  ): Promise<AuthenticationResponse> {
    const enrollments = this.mfaEnrollments.get(userId) || [];
    const enrollment = enrollments.find(e => e.method === method && e.status === 'active');

    if (!enrollment) {
      return {
        success: false,
        error: { code: 'MFA_NOT_ENROLLED', message: 'MFA method not enrolled' },
      };
    }

    // Verify code based on method
    const isValid = await this.verifyMFACode(enrollment, code);
    if (!isValid) {
      return {
        success: false,
        error: { code: 'INVALID_CODE', message: 'Invalid verification code' },
      };
    }

    // Update last used
    enrollment.lastUsedAt = new Date().toISOString();

    // Create or update session with MFA verified
    const existingSession = Array.from(this.sessions.values())
      .find(s => s.userId === userId && s.status === 'active' && !s.mfaVerified);

    if (existingSession) {
      existingSession.mfaVerified = true;
      return {
        success: true,
        userId,
        session: existingSession,
      };
    }

    return {
      success: true,
      userId,
    };
  }

  async logout(sessionId: string): Promise<{ sloUrl?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {};
    }

    session.status = 'logged_out';

    const idp = this.identityProviders.get(session.identityProviderId);
    if (idp?.config.saml?.sloUrl) {
      return { sloUrl: idp.config.saml.sloUrl };
    }

    return {};
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  private async createSession(
    userInfo: { id: string; email: string; displayName: string; attributes: Record<string, any> },
    idp: IdentityProvider,
    tokens: Record<string, string>
  ): Promise<SSOSession> {
    const sessionDuration = idp.metadata.sessionDuration || 480; // 8 hours default

    const session: SSOSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      userId: userInfo.id,
      identityProviderId: idp.id,
      status: 'active',
      authMethod: this.getAuthMethodForIdp(idp.type),
      mfaVerified: !this.checkMFARequirement(userInfo.id, idp),
      attributes: userInfo.attributes,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
      },
      device: {
        id: `device-${Date.now()}`,
        type: 'unknown',
        ipAddress: '0.0.0.0',
        userAgent: '',
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + sessionDuration * 60 * 1000).toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(sessionId: string): Promise<SSOSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      session.status = 'expired';
      return null;
    }

    return session;
  }

  async refreshSession(sessionId: string): Promise<SSOSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return null;

    const idp = this.identityProviders.get(session.identityProviderId);
    if (!idp) return null;

    // Extend session
    const sessionDuration = idp.metadata.sessionDuration || 480;
    session.expiresAt = new Date(Date.now() + sessionDuration * 60 * 1000).toISOString();
    session.lastActivityAt = new Date().toISOString();

    return session;
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'revoked';
    return true;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.status === 'active') {
        session.status = 'revoked';
        count++;
      }
    }
    return count;
  }

  async listUserSessions(userId: string): Promise<SSOSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }

  // ============================================================================
  // MFA Management
  // ============================================================================

  async enrollMFA(
    userId: string,
    method: MFAMethodType
  ): Promise<{ enrollment: UserMFAEnrollment; setupData?: any }> {
    const enrollment: UserMFAEnrollment = {
      userId,
      method,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    let setupData: any = {};

    switch (method) {
      case 'totp':
        enrollment.secret = this.generateTOTPSecret();
        setupData = {
          secret: enrollment.secret,
          qrCode: this.generateTOTPQRCode(userId, enrollment.secret),
        };
        break;
      case 'backup_codes':
        enrollment.backupCodes = this.generateBackupCodes();
        setupData = { codes: enrollment.backupCodes };
        break;
      case 'webauthn':
        setupData = {
          challenge: this.generateWebAuthnChallenge(),
          rpId: this.mfaConfig.methods.find(m => m.type === 'webauthn')?.config?.rpId,
        };
        break;
    }

    const enrollments = this.mfaEnrollments.get(userId) || [];
    enrollments.push(enrollment);
    this.mfaEnrollments.set(userId, enrollments);

    return { enrollment, setupData };
  }

  async confirmMFAEnrollment(
    userId: string,
    method: MFAMethodType,
    verificationCode: string
  ): Promise<boolean> {
    const enrollments = this.mfaEnrollments.get(userId) || [];
    const enrollment = enrollments.find(e => e.method === method && e.status === 'pending');

    if (!enrollment) return false;

    const isValid = await this.verifyMFACode(enrollment, verificationCode);
    if (isValid) {
      enrollment.status = 'active';
      return true;
    }

    return false;
  }

  async disableMFA(userId: string, method: MFAMethodType): Promise<boolean> {
    const enrollments = this.mfaEnrollments.get(userId) || [];
    const enrollment = enrollments.find(e => e.method === method);

    if (!enrollment) return false;

    enrollment.status = 'disabled';
    return true;
  }

  async listUserMFAMethods(userId: string): Promise<UserMFAEnrollment[]> {
    return this.mfaEnrollments.get(userId) || [];
  }

  // ============================================================================
  // Domain Verification
  // ============================================================================

  async initiateDomainVerification(
    domain: string,
    identityProviderId: string,
    method: DomainVerification['method'] = 'dns_txt'
  ): Promise<DomainVerification> {
    const verification: DomainVerification = {
      id: `dv-${Date.now()}`,
      domain,
      identityProviderId,
      status: 'pending',
      method,
      verificationToken: this.generateVerificationToken(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (method === 'dns_txt') {
      verification.dnsRecord = {
        type: 'TXT',
        name: `_portal-verify.${domain}`,
        value: verification.verificationToken,
      };
    }

    this.domainVerifications.set(verification.id, verification);
    return verification;
  }

  async verifyDomain(verificationId: string): Promise<DomainVerification> {
    const verification = this.domainVerifications.get(verificationId);
    if (!verification) {
      throw new Error('Verification not found');
    }

    // In production, actually check DNS records
    // For demo, we'll simulate success
    verification.status = 'verified';
    verification.verifiedAt = new Date().toISOString();

    // Add domain to IdP
    const idp = this.identityProviders.get(verification.identityProviderId);
    if (idp) {
      idp.metadata.domains = idp.metadata.domains || [];
      if (!idp.metadata.domains.includes(verification.domain)) {
        idp.metadata.domains.push(verification.domain);
      }
    }

    return verification;
  }

  // ============================================================================
  // SCIM Provisioning
  // ============================================================================

  async triggerSCIMSync(
    identityProviderId: string,
    type: 'full' | 'incremental' = 'incremental'
  ): Promise<SCIMSyncJob> {
    const job: SCIMSyncJob = {
      id: `scim-${Date.now()}`,
      identityProviderId,
      type,
      status: 'pending',
      progress: 0,
      stats: {
        usersCreated: 0,
        usersUpdated: 0,
        usersDeleted: 0,
        groupsCreated: 0,
        groupsUpdated: 0,
        groupsDeleted: 0,
        errors: 0,
      },
    };

    this.scimJobs.set(job.id, job);

    // Simulate async sync
    this.processSCIMSync(job.id);

    return job;
  }

  private async processSCIMSync(jobId: string): Promise<void> {
    const job = this.scimJobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    job.startedAt = new Date().toISOString();

    // Simulate sync progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      job.progress = i;
    }

    // Simulate some results
    job.stats = {
      usersCreated: 5,
      usersUpdated: 12,
      usersDeleted: 1,
      groupsCreated: 2,
      groupsUpdated: 3,
      groupsDeleted: 0,
      errors: 0,
    };

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  }

  async getSCIMSyncJob(jobId: string): Promise<SCIMSyncJob | null> {
    return this.scimJobs.get(jobId) || null;
  }

  // ============================================================================
  // Service Provider Metadata
  // ============================================================================

  getServiceProviderMetadata(): ServiceProviderMetadata {
    return this.serviceProviderMetadata;
  }

  generateSAMLMetadataXML(): string {
    const sp = this.serviceProviderMetadata;
    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${sp.entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="${sp.signAuthnRequests}" WantAssertionsSigned="${sp.wantAssertionsSigned}" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>${sp.nameIdFormat}</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${sp.acsUrl}" index="0" isDefault="true"/>
    ${sp.sloUrl ? `<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${sp.sloUrl}"/>` : ''}
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getAuthMethodForIdp(type: IdentityProviderType): AuthMethod {
    switch (type) {
      case 'saml':
        return 'saml';
      case 'oidc':
      case 'okta':
      case 'auth0':
      case 'azure-ad':
      case 'google-workspace':
      case 'onelogin':
      case 'ping-identity':
        return 'oidc';
      case 'oauth2':
        return 'oauth2';
      case 'ldap':
        return 'ldap';
      default:
        return 'oidc';
    }
  }

  private buildAuthUrl(idp: IdentityProvider, request: AuthenticationRequest): string {
    if (idp.config.saml) {
      // Build SAML AuthnRequest URL
      return `${idp.config.saml.ssoUrl}?SAMLRequest=${encodeURIComponent('...')}&RelayState=${request.relayState}`;
    }

    // Build OIDC/OAuth2 authorization URL
    const params = new URLSearchParams({
      client_id: idp.config.clientId || '',
      redirect_uri: `${this.serviceProviderMetadata.acsUrl.replace('/saml/acs', '/callback')}`,
      response_type: 'code',
      scope: idp.config.scopes?.join(' ') || 'openid profile email',
      state: request.relayState || '',
      nonce: request.nonce || '',
    });

    if (request.codeChallenge) {
      params.set('code_challenge', request.codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return `${idp.config.authorizationUrl}?${params.toString()}`;
  }

  private async validateAuthResponse(
    idp: IdentityProvider,
    request: AuthenticationRequest,
    params: Record<string, string>
  ): Promise<{ id: string; email: string; displayName: string; attributes: Record<string, any> }> {
    // In production, this would validate SAML assertions or exchange OAuth code for tokens
    // For demo, return mock user info
    return {
      id: `user-${Date.now()}`,
      email: 'user@company.com',
      displayName: 'Demo User',
      attributes: {
        groups: ['Engineering'],
        department: 'Engineering',
      },
    };
  }

  private checkMFARequirement(userId: string, idp: IdentityProvider): boolean {
    if (!this.mfaConfig.enabled) return false;
    if (idp.metadata.mfaRequired) return true;
    if (this.mfaConfig.required) return true;
    // Check if user has roles that require MFA
    return false;
  }

  private async verifyMFACode(enrollment: UserMFAEnrollment, code: string): Promise<boolean> {
    switch (enrollment.method) {
      case 'totp':
        return this.verifyTOTP(enrollment.secret!, code);
      case 'backup_codes':
        return enrollment.backupCodes?.includes(code) || false;
      default:
        return false;
    }
  }

  private verifyTOTP(secret: string, code: string): boolean {
    // In production, use a proper TOTP library
    return code.length === 6 && /^\d+$/.test(code);
  }

  private generateRelayState(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateCodeVerifier(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private generateTOTPSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateTOTPQRCode(userId: string, secret: string): string {
    const issuer = 'DeveloperPortal';
    return `otpauth://totp/${issuer}:${userId}?secret=${secret}&issuer=${issuer}`;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  private generateWebAuthnChallenge(): string {
    return Math.random().toString(36).substring(2, 34);
  }

  private generateVerificationToken(): string {
    return `portal-verify-${Math.random().toString(36).substring(2, 34)}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let ssoServiceInstance: SSOService | null = null;

export function getSSOService(): SSOService {
  if (!ssoServiceInstance) {
    ssoServiceInstance = new SSOService();
  }
  return ssoServiceInstance;
}
