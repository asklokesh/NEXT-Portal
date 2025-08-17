/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { randomBytes } from 'crypto';
import { createAuditLog } from '../../audit/service';
import { UserRepository } from '../../db/repositories/UserRepository';
import { sessionRedis } from '../../db/client';
import type { User } from '@prisma/client';

const userRepository = new UserRepository();

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  callbackUrl: string;
  logoutUrl?: string;
  authEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
}

export interface OIDCTokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
}

export interface OIDCProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  groups?: string[];
  roles?: string[];
  [key: string]: any;
}

/**
 * Get OIDC configuration from environment variables
 */
export const getOIDCConfig = async (): Promise<OIDCConfig | null> => {
  const enabled = process.env.OIDC_ENABLED === 'true';
  if (!enabled) return null;

  const config: OIDCConfig = {
    issuer: process.env.OIDC_ISSUER!,
    clientId: process.env.OIDC_CLIENT_ID!,
    clientSecret: process.env.OIDC_CLIENT_SECRET!,
    scope: process.env.OIDC_SCOPE || 'openid profile email',
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oidc/callback`,
    logoutUrl: process.env.OIDC_LOGOUT_URL,
  };

  // Validate required config
  if (!config.issuer || !config.clientId || !config.clientSecret) {
    console.error('OIDC configuration incomplete');
    return null;
  }

  // Discover endpoints if not provided
  try {
    const discoveryUrl = `${config.issuer}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl);
    
    if (response.ok) {
      const discovery = await response.json();
      config.authEndpoint = discovery.authorization_endpoint;
      config.tokenEndpoint = discovery.token_endpoint;
      config.userinfoEndpoint = discovery.userinfo_endpoint;
      config.logoutUrl = config.logoutUrl || discovery.end_session_endpoint;
    }
  } catch (error) {
    console.error('OIDC discovery failed:', error);
  }

  // Fallback to manual endpoints if discovery failed
  if (!config.authEndpoint) {
    config.authEndpoint = `${config.issuer}/auth`;
    config.tokenEndpoint = `${config.issuer}/token`;
    config.userinfoEndpoint = `${config.issuer}/userinfo`;
  }

  return config;
};

/**
 * Generate OIDC authentication URL
 */
export const generateOIDCAuthUrl = async (returnTo?: string): Promise<string> => {
  const config = await getOIDCConfig();
  if (!config || !config.authEndpoint) {
    throw new Error('OIDC not configured');
  }

  // Generate state and nonce for security
  const state = randomBytes(32).toString('hex');
  const nonce = randomBytes(16).toString('hex');

  // Store state in Redis for validation
  const stateData = {
    returnTo: returnTo || '/dashboard',
    timestamp: Date.now(),
    nonce,
  };

  await sessionRedis.setex(
    `oidc_state:${state}`,
    600, // 10 minutes
    JSON.stringify(stateData)
  );

  // Build authorization URL
  const authUrl = new URL(config.authEndpoint);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('redirect_uri', config.callbackUrl);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);

  return authUrl.toString();
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeOIDCCode = async (
  code: string,
  state: string
): Promise<{ tokens: OIDCTokens; returnTo: string } | null> => {
  try {
    const config = await getOIDCConfig();
    if (!config || !config.tokenEndpoint) {
      throw new Error('OIDC not configured');
    }

    // Validate state
    const stateData = await sessionRedis.get(`oidc_state:${state}`);
    if (!stateData) {
      throw new Error('Invalid or expired state');
    }

    const parsedState = JSON.parse(stateData);
    
    // Validate timestamp
    if (Date.now() - parsedState.timestamp > 600000) { // 10 minutes
      await sessionRedis.del(`oidc_state:${state}`);
      throw new Error('State expired');
    }

    // Clean up used state
    await sessionRedis.del(`oidc_state:${state}`);

    // Exchange code for tokens
    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.callbackUrl,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokens: OIDCTokens = await tokenResponse.json();

    return {
      tokens,
      returnTo: parsedState.returnTo,
    };
  } catch (error) {
    console.error('OIDC code exchange failed:', error);
    return null;
  }
};

/**
 * Get user profile from userinfo endpoint
 */
export const getOIDCProfile = async (accessToken: string): Promise<OIDCProfile | null> => {
  try {
    const config = await getOIDCConfig();
    if (!config || !config.userinfoEndpoint) {
      throw new Error('OIDC not configured');
    }

    const response = await fetch(config.userinfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Userinfo request failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('OIDC profile fetch failed:', error);
    return null;
  }
};

/**
 * Decode and validate ID token (JWT)
 */
export const validateIDToken = async (
  idToken: string,
  nonce?: string
): Promise<OIDCProfile | null> => {
  try {
    // In production, use a proper JWT library with signature validation
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    // Validate nonce if provided
    if (nonce && payload.nonce !== nonce) {
      throw new Error('Nonce mismatch');
    }

    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('ID token expired');
    }

    return payload as OIDCProfile;
  } catch (error) {
    console.error('ID token validation failed:', error);
    return null;
  }
};

/**
 * Process OIDC authentication
 */
export const processOIDCAuth = async (
  profile: OIDCProfile,
  ipAddress: string,
  userAgent: string
): Promise<{ user: User; isNewUser: boolean } | null> => {
  const email = profile.email;

  if (!email) {
    await createAuditLog({
      action: 'sso.oidc.no_email',
      resource: 'authentication',
      resourceId: null,
      userId: null,
      details: {
        sub: profile.sub,
        ipAddress,
        userAgent,
      },
      status: 'failed',
    });
    return null;
  }

  // Validate email is verified if available
  if (profile.email_verified === false) {
    await createAuditLog({
      action: 'sso.oidc.unverified_email',
      resource: 'authentication',
      resourceId: null,
      userId: null,
      details: {
        email,
        sub: profile.sub,
        ipAddress,
        userAgent,
      },
      status: 'failed',
    });
    return null;
  }

  // Find or create user
  let user = await userRepository.findByEmail(email);
  let isNewUser = false;

  // Determine user role from OIDC attributes
  const userRole = determineOIDCRole(profile);

  if (!user) {
    // Create new user
    isNewUser = true;
    user = await userRepository.create({
      email,
      name: profile.name || profile.preferred_username || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || email,
      username: profile.preferred_username || email.split('@')[0],
      avatar: profile.picture,
      provider: 'oidc',
      providerId: profile.sub,
      role: userRole,
      isActive: true,
      lastLogin: new Date(),
    });

    await createAuditLog({
      action: 'sso.oidc.user_created',
      resource: 'user',
      resourceId: user.id,
      userId: user.id,
      details: {
        email,
        sub: profile.sub,
        role: userRole,
        groups: profile.groups,
        roles: profile.roles,
        ipAddress,
        userAgent,
      },
      status: 'success',
    });
  } else {
    // Update existing user
    user = await userRepository.update(user.id, {
      name: profile.name || user.name,
      username: profile.preferred_username || user.username,
      avatar: profile.picture || user.avatar,
      provider: 'oidc',
      providerId: profile.sub,
      role: userRole, // Update role based on current claims
      lastLogin: new Date(),
    });

    await createAuditLog({
      action: 'sso.oidc.user_updated',
      resource: 'user',
      resourceId: user.id,
      userId: user.id,
      details: {
        email,
        sub: profile.sub,
        role: userRole,
        groups: profile.groups,
        roles: profile.roles,
        ipAddress,
        userAgent,
      },
      status: 'success',
    });
  }

  if (!user.isActive) {
    await createAuditLog({
      action: 'sso.oidc.inactive_account',
      resource: 'user',
      resourceId: user.id,
      userId: user.id,
      details: {
        email,
        ipAddress,
        userAgent,
      },
      status: 'failed',
    });
    return null;
  }

  await createAuditLog({
    action: 'sso.oidc.success',
    resource: 'authentication',
    resourceId: user.id,
    userId: user.id,
    details: {
      email,
      sub: profile.sub,
      isNewUser,
      ipAddress,
      userAgent,
    },
    status: 'success',
  });

  return { user, isNewUser };
};

/**
 * Generate OIDC logout URL
 */
export const generateOIDCLogoutUrl = async (
  user: User,
  idTokenHint?: string
): Promise<string> => {
  const config = await getOIDCConfig();
  if (!config || !config.logoutUrl) {
    throw new Error('OIDC logout not configured');
  }

  const logoutUrl = new URL(config.logoutUrl);
  
  if (idTokenHint) {
    logoutUrl.searchParams.set('id_token_hint', idTokenHint);
  }

  logoutUrl.searchParams.set('post_logout_redirect_uri', 
    `${process.env.NEXT_PUBLIC_APP_URL}/auth/logout-complete`);

  return logoutUrl.toString();
};

/**
 * Determine user role from OIDC claims
 */
const determineOIDCRole = (profile: OIDCProfile): 'ADMIN' | 'PLATFORM_ENGINEER' | 'DEVELOPER' => {
  const adminRoles = (process.env.OIDC_ADMIN_ROLES || '').split(',').map(r => r.trim()).filter(Boolean);
  const adminGroups = (process.env.OIDC_ADMIN_GROUPS || '').split(',').map(g => g.trim()).filter(Boolean);
  const engineerRoles = (process.env.OIDC_ENGINEER_ROLES || '').split(',').map(r => r.trim()).filter(Boolean);
  const engineerGroups = (process.env.OIDC_ENGINEER_GROUPS || '').split(',').map(g => g.trim()).filter(Boolean);

  // Check roles
  if (profile.roles) {
    for (const role of profile.roles) {
      if (adminRoles.includes(role)) {
        return 'ADMIN';
      }
      if (engineerRoles.includes(role)) {
        return 'PLATFORM_ENGINEER';
      }
    }
  }

  // Check groups
  if (profile.groups) {
    for (const group of profile.groups) {
      if (adminGroups.includes(group)) {
        return 'ADMIN';
      }
      if (engineerGroups.includes(group)) {
        return 'PLATFORM_ENGINEER';
      }
    }
  }

  return 'DEVELOPER';
};