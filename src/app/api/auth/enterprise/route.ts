import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

interface EnterpriseAuthConfig {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'ldap' | 'azure-ad' | 'okta' | 'auth0';
  enabled: boolean;
  config: AuthProviderConfig;
  metadata: AuthMetadata;
  security: AuthSecurity;
  userMapping: UserAttributeMapping;
  groupMapping: GroupMapping[];
  created: string;
  updated: string;
}

interface AuthProviderConfig {
  // SAML Configuration
  saml?: {
    entryPoint: string;
    issuer: string;
    cert: string;
    privateCert?: string;
    signatureAlgorithm: 'sha1' | 'sha256' | 'sha512';
    digestAlgorithm: 'sha1' | 'sha256' | 'sha512';
    requestTemplate?: string;
    validateInResponseTo: boolean;
    disableRequestedAuthnContext: boolean;
    authnContext: string[];
    forceAuthn: boolean;
    skipRequestCompression: boolean;
    authnRequestBinding: 'HTTP-POST' | 'HTTP-Redirect';
    attributeConsumingServiceIndex?: number;
    assertionConsumerServiceURL: string;
    acceptedClockSkewMs: number;
  };

  // OIDC Configuration  
  oidc?: {
    clientId: string;
    clientSecret: string;
    issuer: string;
    authorizationURL: string;
    tokenURL: string;
    userInfoURL: string;
    jwksURL: string;
    scopes: string[];
    responseType: 'code' | 'id_token' | 'token';
    responseMode: 'query' | 'fragment' | 'form_post';
    grantType: 'authorization_code' | 'implicit' | 'client_credentials';
    codeChallengeMethod: 'plain' | 'S256';
    nonce: boolean;
    state: boolean;
    maxAge?: number;
    acrValues?: string[];
    prompt?: 'none' | 'login' | 'consent' | 'select_account';
  };

  // LDAP Configuration
  ldap?: {
    url: string;
    bindDN: string;
    bindCredentials: string;
    searchBase: string;
    searchFilter: string;
    searchAttributes: string[];
    groupSearchBase: string;
    groupSearchFilter: string;
    groupSearchAttributes: string[];
    tlsOptions?: {
      rejectUnauthorized: boolean;
      ca?: string[];
      cert?: string;
      key?: string;
    };
    reconnect: boolean;
    timeout: number;
    connectTimeout: number;
    idleTimeout: number;
    paging: boolean;
    pageSize: number;
  };

  // Azure AD Configuration
  azureAd?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    authority: string;
    validateAuthority: boolean;
    knownAuthorities: string[];
    cloudDiscoveryMetadata?: string;
    authorityMetadata?: string;
    clientCapabilities: string[];
    protocolMode: 'AAD' | 'OIDC';
    skipAuthorityMetadataCache: boolean;
  };

  // Generic OAuth2 settings
  oauth2?: {
    authorizationParams?: Record<string, string>;
    tokenParams?: Record<string, string>;
    headers?: Record<string, string>;
    customParams?: Record<string, any>;
  };
}

interface AuthMetadata {
  displayName: string;
  description?: string;
  logoUrl?: string;
  supportContact?: string;
  documentationUrl?: string;
  priority: number;
  domains: string[];
  tags: string[];
}

interface AuthSecurity {
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'aes-192-gcm' | 'aes-128-gcm';
    keyRotation: boolean;
    keyRotationInterval: number;
  };
  signature: {
    required: boolean;
    algorithm: 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512';
    keyId?: string;
  };
  certificate: {
    validation: boolean;
    allowSelfSigned: boolean;
    certificateChain?: string[];
    trustedCAs?: string[];
  };
  session: {
    timeout: number;
    renewalThreshold: number;
    maxConcurrentSessions: number;
    requireReauth: boolean;
  };
  rateLimit: {
    enabled: boolean;
    requests: number;
    window: number;
    blockDuration: number;
  };
}

interface UserAttributeMapping {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string;
  roles?: string;
  department?: string;
  title?: string;
  manager?: string;
  phoneNumber?: string;
  customAttributes?: Record<string, string>;
}

interface GroupMapping {
  externalGroup: string;
  internalRole: string;
  permissions: string[];
  description?: string;
  priority: number;
}

interface AuthSession {
  id: string;
  userId: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresAt: string;
  refreshExpiresAt?: string;
  scopes: string[];
  claims: Record<string, any>;
  userInfo: UserInfo;
  metadata: SessionMetadata;
  created: string;
  lastAccessed: string;
}

interface UserInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  locale?: string;
  timezone?: string;
  groups: string[];
  roles: string[];
  permissions: string[];
  customClaims?: Record<string, any>;
}

interface SessionMetadata {
  ipAddress: string;
  userAgent: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os?: string;
    browser?: string;
  };
  authMethod: string;
  riskScore?: number;
}

interface AuthAuditLog {
  id: string;
  event: AuthEvent;
  userId?: string;
  sessionId?: string;
  providerId?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

type AuthEvent = 
  | 'login_attempt'
  | 'login_success'
  | 'login_failure' 
  | 'logout'
  | 'token_refresh'
  | 'token_revoke'
  | 'session_timeout'
  | 'password_change'
  | 'mfa_challenge'
  | 'mfa_success'
  | 'mfa_failure'
  | 'account_locked'
  | 'account_unlocked'
  | 'permission_denied'
  | 'suspicious_activity';

interface SAMLResponse {
  nameID: string;
  nameIDFormat: string;
  sessionIndex: string;
  attributes: Record<string, string | string[]>;
  issuer: string;
  inResponseTo?: string;
  notBefore?: string;
  notOnOrAfter?: string;
  audience?: string;
}

interface OIDCTokens {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
}

// Storage
const authConfigs = new Map<string, EnterpriseAuthConfig>();
const activeSessions = new Map<string, AuthSession>();
const auditLogs: AuthAuditLog[] = [];

// JWT Secret (in production, use environment variable)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-256-bit-secret-key-here-must-be-long-enough'
);

// Initialize sample configurations
const initializeSampleConfigs = () => {
  const configs: EnterpriseAuthConfig[] = [
    {
      id: 'azure-ad-main',
      name: 'Azure Active Directory',
      type: 'azure-ad',
      enabled: true,
      config: {
        azureAd: {
          tenantId: 'common',
          clientId: 'your-client-id',
          clientSecret: 'your-client-secret',
          redirectUri: 'https://your-domain.com/api/auth/callback/azure',
          scopes: ['openid', 'profile', 'email', 'User.Read'],
          authority: 'https://login.microsoftonline.com/common',
          validateAuthority: true,
          knownAuthorities: [],
          clientCapabilities: [],
          protocolMode: 'OIDC',
          skipAuthorityMetadataCache: false
        }
      },
      metadata: {
        displayName: 'Sign in with Microsoft',
        description: 'Enterprise Azure Active Directory authentication',
        logoUrl: '/logos/microsoft.svg',
        supportContact: 'it-support@company.com',
        priority: 1,
        domains: ['company.com', 'subsidiary.com'],
        tags: ['enterprise', 'microsoft', 'primary']
      },
      security: {
        encryption: {
          enabled: true,
          algorithm: 'aes-256-gcm',
          keyRotation: true,
          keyRotationInterval: 86400000 // 24 hours
        },
        signature: {
          required: true,
          algorithm: 'RS256'
        },
        certificate: {
          validation: true,
          allowSelfSigned: false
        },
        session: {
          timeout: 28800000, // 8 hours
          renewalThreshold: 3600000, // 1 hour
          maxConcurrentSessions: 5,
          requireReauth: false
        },
        rateLimit: {
          enabled: true,
          requests: 10,
          window: 60000,
          blockDuration: 300000
        }
      },
      userMapping: {
        userId: 'oid',
        email: 'mail',
        firstName: 'givenName',
        lastName: 'surname',
        displayName: 'displayName',
        groups: 'groups',
        department: 'department',
        title: 'jobTitle'
      },
      groupMapping: [
        {
          externalGroup: 'Backstage-Admins',
          internalRole: 'admin',
          permissions: ['*'],
          description: 'Full system administrators',
          priority: 1
        },
        {
          externalGroup: 'Backstage-Users',
          internalRole: 'user',
          permissions: ['catalog:read', 'plugins:read'],
          description: 'Standard users',
          priority: 2
        }
      ],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    {
      id: 'okta-sso',
      name: 'Okta SSO',
      type: 'oidc',
      enabled: true,
      config: {
        oidc: {
          clientId: 'your-okta-client-id',
          clientSecret: 'your-okta-client-secret',
          issuer: 'https://your-domain.okta.com',
          authorizationURL: 'https://your-domain.okta.com/oauth2/v1/authorize',
          tokenURL: 'https://your-domain.okta.com/oauth2/v1/token',
          userInfoURL: 'https://your-domain.okta.com/oauth2/v1/userinfo',
          jwksURL: 'https://your-domain.okta.com/oauth2/v1/keys',
          scopes: ['openid', 'profile', 'email', 'groups'],
          responseType: 'code',
          responseMode: 'query',
          grantType: 'authorization_code',
          codeChallengeMethod: 'S256',
          nonce: true,
          state: true
        }
      },
      metadata: {
        displayName: 'Sign in with Okta',
        description: 'Okta single sign-on integration',
        logoUrl: '/logos/okta.svg',
        priority: 2,
        domains: ['okta-domain.com'],
        tags: ['enterprise', 'okta', 'secondary']
      },
      security: {
        encryption: {
          enabled: true,
          algorithm: 'aes-256-gcm',
          keyRotation: true,
          keyRotationInterval: 86400000
        },
        signature: {
          required: true,
          algorithm: 'RS256'
        },
        certificate: {
          validation: true,
          allowSelfSigned: false
        },
        session: {
          timeout: 28800000,
          renewalThreshold: 3600000,
          maxConcurrentSessions: 3,
          requireReauth: false
        },
        rateLimit: {
          enabled: true,
          requests: 10,
          window: 60000,
          blockDuration: 300000
        }
      },
      userMapping: {
        userId: 'sub',
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
        groups: 'groups'
      },
      groupMapping: [
        {
          externalGroup: 'Everyone',
          internalRole: 'user',
          permissions: ['catalog:read'],
          description: 'All authenticated users',
          priority: 10
        }
      ],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  ];

  configs.forEach(config => {
    authConfigs.set(config.id, config);
  });
};

// Initialize sample configurations
initializeSampleConfigs();

// Create JWT token
const createJWT = async (payload: any, expiresIn = '8h'): Promise<string> => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
};

// Verify JWT token
const verifyJWT = async (token: string): Promise<any> => {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
};

// Process SAML response
const processSAMLResponse = async (
  samlResponse: string,
  config: EnterpriseAuthConfig
): Promise<{ success: boolean; userInfo?: UserInfo; error?: string }> => {
  try {
    // In production, use a proper SAML library like node-saml
    // This is a simplified simulation
    const decoded = Buffer.from(samlResponse, 'base64').toString();
    
    // Simulate SAML parsing
    const mockSAMLData: SAMLResponse = {
      nameID: 'user@company.com',
      nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      sessionIndex: crypto.randomBytes(16).toString('hex'),
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@company.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'John',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'Doe',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups': ['Backstage-Users']
      },
      issuer: 'https://sts.company.com',
      audience: 'https://your-domain.com'
    };

    // Map SAML attributes to user info
    const userInfo: UserInfo = {
      id: mockSAMLData.nameID,
      email: mockSAMLData.nameID,
      emailVerified: true,
      name: `${mockSAMLData.attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname']} ${mockSAMLData.attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname']}`,
      givenName: mockSAMLData.attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] as string,
      familyName: mockSAMLData.attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] as string,
      groups: Array.isArray(mockSAMLData.attributes['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups']) 
        ? mockSAMLData.attributes['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] as string[]
        : [mockSAMLData.attributes['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] as string],
      roles: [],
      permissions: []
    };

    // Map groups to roles
    config.groupMapping.forEach(mapping => {
      if (userInfo.groups.includes(mapping.externalGroup)) {
        userInfo.roles.push(mapping.internalRole);
        userInfo.permissions.push(...mapping.permissions);
      }
    });

    return { success: true, userInfo };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'SAML processing failed' 
    };
  }
};

// Process OIDC tokens
const processOIDCTokens = async (
  tokens: OIDCTokens,
  config: EnterpriseAuthConfig
): Promise<{ success: boolean; userInfo?: UserInfo; error?: string }> => {
  try {
    // In production, verify JWT signature and fetch user info
    // This is a simplified simulation
    const idTokenPayload = JSON.parse(
      Buffer.from(tokens.idToken.split('.')[1], 'base64').toString()
    );

    const userInfo: UserInfo = {
      id: idTokenPayload.sub,
      email: idTokenPayload.email,
      emailVerified: idTokenPayload.email_verified || false,
      name: idTokenPayload.name || `${idTokenPayload.given_name} ${idTokenPayload.family_name}`,
      givenName: idTokenPayload.given_name,
      familyName: idTokenPayload.family_name,
      picture: idTokenPayload.picture,
      groups: idTokenPayload.groups || [],
      roles: [],
      permissions: []
    };

    // Map groups to roles
    config.groupMapping.forEach(mapping => {
      if (userInfo.groups.includes(mapping.externalGroup)) {
        userInfo.roles.push(mapping.internalRole);
        userInfo.permissions.push(...mapping.permissions);
      }
    });

    return { success: true, userInfo };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'OIDC token processing failed' 
    };
  }
};

// Create auth session
const createAuthSession = async (
  userInfo: UserInfo,
  providerId: string,
  tokens?: any,
  metadata?: Partial<SessionMetadata>
): Promise<AuthSession> => {
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  const session: AuthSession = {
    id: sessionId,
    userId: userInfo.id,
    providerId,
    accessToken: tokens?.accessToken,
    refreshToken: tokens?.refreshToken,
    idToken: tokens?.idToken,
    tokenType: tokens?.tokenType || 'Bearer',
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
    refreshExpiresAt: tokens?.refreshToken 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      : undefined,
    scopes: tokens?.scope?.split(' ') || [],
    claims: {},
    userInfo,
    metadata: {
      ipAddress: metadata?.ipAddress || '127.0.0.1',
      userAgent: metadata?.userAgent || 'Unknown',
      location: metadata?.location,
      device: metadata?.device,
      authMethod: providerId,
      riskScore: metadata?.riskScore || 0
    },
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString()
  };

  activeSessions.set(sessionId, session);
  return session;
};

// Log auth event
const logAuthEvent = (
  event: AuthEvent,
  success: boolean,
  metadata: Partial<AuthAuditLog> = {}
): void => {
  const log: AuthAuditLog = {
    id: crypto.randomBytes(16).toString('hex'),
    event,
    userId: metadata.userId,
    sessionId: metadata.sessionId,
    providerId: metadata.providerId,
    timestamp: new Date().toISOString(),
    ipAddress: metadata.ipAddress || '127.0.0.1',
    userAgent: metadata.userAgent || 'Unknown',
    success,
    error: metadata.error,
    metadata: metadata.metadata
  };

  auditLogs.push(log);
  
  // Keep only last 10000 logs in memory
  if (auditLogs.length > 10000) {
    auditLogs.splice(0, auditLogs.length - 10000);
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    switch (action) {
      case 'configure': {
        const config: EnterpriseAuthConfig = {
          id: crypto.randomBytes(8).toString('hex'),
          name: body.name,
          type: body.type,
          enabled: body.enabled !== false,
          config: body.config,
          metadata: body.metadata || {
            displayName: body.name,
            priority: 10,
            domains: [],
            tags: []
          },
          security: body.security || {
            encryption: {
              enabled: true,
              algorithm: 'aes-256-gcm',
              keyRotation: true,
              keyRotationInterval: 86400000
            },
            signature: {
              required: true,
              algorithm: 'RS256'
            },
            certificate: {
              validation: true,
              allowSelfSigned: false
            },
            session: {
              timeout: 28800000,
              renewalThreshold: 3600000,
              maxConcurrentSessions: 5,
              requireReauth: false
            },
            rateLimit: {
              enabled: true,
              requests: 10,
              window: 60000,
              blockDuration: 300000
            }
          },
          userMapping: body.userMapping,
          groupMapping: body.groupMapping || [],
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        authConfigs.set(config.id, config);

        return NextResponse.json({
          success: true,
          config
        });
      }

      case 'authenticate': {
        const { providerId, credentials, metadata } = body;
        
        const config = authConfigs.get(providerId);
        if (!config || !config.enabled) {
          logAuthEvent('login_failure', false, {
            providerId,
            ipAddress,
            userAgent,
            error: 'Provider not found or disabled'
          });

          return NextResponse.json({
            success: false,
            error: 'Authentication provider not available'
          }, { status: 400 });
        }

        let authResult: { success: boolean; userInfo?: UserInfo; error?: string };

        // Process authentication based on provider type
        switch (config.type) {
          case 'saml':
            authResult = await processSAMLResponse(credentials.samlResponse, config);
            break;
          
          case 'oidc':
          case 'azure-ad':
          case 'okta':
            authResult = await processOIDCTokens(credentials.tokens, config);
            break;
          
          default:
            authResult = { success: false, error: 'Unsupported provider type' };
        }

        if (!authResult.success || !authResult.userInfo) {
          logAuthEvent('login_failure', false, {
            providerId,
            ipAddress,
            userAgent,
            error: authResult.error
          });

          return NextResponse.json({
            success: false,
            error: authResult.error || 'Authentication failed'
          }, { status: 401 });
        }

        // Create session
        const session = await createAuthSession(
          authResult.userInfo,
          providerId,
          credentials.tokens,
          { ipAddress, userAgent, ...metadata }
        );

        // Create JWT
        const jwt = await createJWT({
          sessionId: session.id,
          userId: session.userId,
          email: session.userInfo.email,
          roles: session.userInfo.roles,
          permissions: session.userInfo.permissions
        });

        logAuthEvent('login_success', true, {
          userId: session.userId,
          sessionId: session.id,
          providerId,
          ipAddress,
          userAgent
        });

        return NextResponse.json({
          success: true,
          token: jwt,
          session: {
            id: session.id,
            user: session.userInfo,
            expiresAt: session.expiresAt
          }
        });
      }

      case 'refresh': {
        const { sessionId, refreshToken } = body;
        
        const session = activeSessions.get(sessionId);
        if (!session || session.refreshToken !== refreshToken) {
          return NextResponse.json({
            success: false,
            error: 'Invalid session or refresh token'
          }, { status: 401 });
        }

        // Check if refresh token is expired
        if (session.refreshExpiresAt && new Date() > new Date(session.refreshExpiresAt)) {
          activeSessions.delete(sessionId);
          return NextResponse.json({
            success: false,
            error: 'Refresh token expired'
          }, { status: 401 });
        }

        // Extend session
        session.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        session.lastAccessed = new Date().toISOString();

        // Create new JWT
        const jwt = await createJWT({
          sessionId: session.id,
          userId: session.userId,
          email: session.userInfo.email,
          roles: session.userInfo.roles,
          permissions: session.userInfo.permissions
        });

        logAuthEvent('token_refresh', true, {
          userId: session.userId,
          sessionId: session.id,
          ipAddress,
          userAgent
        });

        return NextResponse.json({
          success: true,
          token: jwt,
          expiresAt: session.expiresAt
        });
      }

      case 'logout': {
        const { sessionId } = body;
        
        const session = activeSessions.get(sessionId);
        if (session) {
          activeSessions.delete(sessionId);
          
          logAuthEvent('logout', true, {
            userId: session.userId,
            sessionId: session.id,
            providerId: session.providerId,
            ipAddress,
            userAgent
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Logged out successfully'
        });
      }

      case 'validate': {
        const { token } = body;
        
        try {
          const payload = await verifyJWT(token);
          const session = activeSessions.get(payload.sessionId as string);
          
          if (!session || new Date() > new Date(session.expiresAt)) {
            return NextResponse.json({
              success: false,
              valid: false,
              error: 'Session expired'
            }, { status: 401 });
          }

          // Update last accessed
          session.lastAccessed = new Date().toISOString();

          return NextResponse.json({
            success: true,
            valid: true,
            user: session.userInfo,
            session: {
              id: session.id,
              expiresAt: session.expiresAt
            }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            valid: false,
            error: 'Invalid token'
          }, { status: 401 });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Enterprise auth error:', error);
    return NextResponse.json({
      success: false,
      error: 'Authentication service error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (type === 'providers') {
      return NextResponse.json({
        success: true,
        providers: Array.from(authConfigs.values()).map(config => ({
          id: config.id,
          name: config.name,
          type: config.type,
          enabled: config.enabled,
          metadata: config.metadata
        }))
      });
    }

    if (type === 'config' && id) {
      const config = authConfigs.get(id);
      if (!config) {
        return NextResponse.json({
          success: false,
          error: 'Configuration not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        config
      });
    }

    if (type === 'sessions') {
      const sessionList = Array.from(activeSessions.values()).map(session => ({
        id: session.id,
        userId: session.userId,
        userInfo: {
          email: session.userInfo.email,
          name: session.userInfo.name
        },
        providerId: session.providerId,
        created: session.created,
        lastAccessed: session.lastAccessed,
        expiresAt: session.expiresAt,
        metadata: session.metadata
      }));

      return NextResponse.json({
        success: true,
        sessions: sessionList,
        total: sessionList.length
      });
    }

    if (type === 'audit') {
      const limit = parseInt(searchParams.get('limit') || '100');
      const offset = parseInt(searchParams.get('offset') || '0');
      
      return NextResponse.json({
        success: true,
        logs: auditLogs.slice(offset, offset + limit),
        total: auditLogs.length
      });
    }

    // Return summary
    return NextResponse.json({
      success: true,
      summary: {
        providers: authConfigs.size,
        activeSessions: activeSessions.size,
        auditLogs: auditLogs.length
      }
    });

  } catch (error) {
    console.error('Enterprise auth GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch auth data'
    }, { status: 500 });
  }
}