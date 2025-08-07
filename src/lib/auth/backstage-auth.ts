import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { createAuditLog } from '../audit/service';

// Backstage token payload schema
const BackstageTokenPayloadSchema = z.object({
 sub: z.string(), // entityRef like 'user:default/john.doe'
 ent: z.array(z.string()), // entity references the user belongs to
 exp: z.number().optional(),
 iat: z.number().optional(),
});

// Backstage user identity schema
const BackstageIdentitySchema = z.object({
 type: z.literal('user'),
 userEntityRef: z.string(),
 ownershipEntityRefs: z.array(z.string()),
});

export type BackstageTokenPayload = z.infer<typeof BackstageTokenPayloadSchema>;
export type BackstageIdentity = z.infer<typeof BackstageIdentitySchema>;

/**
 * Verify and decode a Backstage auth token
 */
export async function verifyBackstageToken(token: string): Promise<BackstageTokenPayload | null> {
 try {
 // Get Backstage backend URL and auth config
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 const backstageAuthSecret = process.env.BACKSTAGE_AUTH_SECRET;
 
 // If we have a shared secret, verify locally
 if (backstageAuthSecret) {
 const payload = jwt.verify(token, backstageAuthSecret) as any;
 return BackstageTokenPayloadSchema.parse(payload);
 }
 
 // Otherwise, validate with Backstage backend
 const response = await fetch(`${backstageUrl}/api/auth/v1/validate`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json',
 },
 });
 
 if (!response.ok) {
 console.error('Backstage token validation failed:', response.status);
 return null;
 }
 
 const data = await response.json();
 return BackstageTokenPayloadSchema.parse(data);
 } catch (error) {
 console.error('Failed to verify Backstage token:', error);
 return null;
 }
}

/**
 * Get user identity from Backstage
 */
export async function getBackstageIdentity(token: string): Promise<BackstageIdentity | null> {
 try {
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 
 const response = await fetch(`${backstageUrl}/api/auth/v1/identity`, {
 headers: {
 'Authorization': `Bearer ${token}`,
 },
 });
 
 if (!response.ok) {
 console.error('Failed to get Backstage identity:', response.status);
 return null;
 }
 
 const data = await response.json();
 return BackstageIdentitySchema.parse(data.identity);
 } catch (error) {
 console.error('Failed to get Backstage identity:', error);
 return null;
 }
}

/**
 * Extract Backstage token from request
 */
export function extractBackstageToken(req: NextRequest): string | null {
 // Check Authorization header
 const authHeader = req.headers.get('authorization');
 if (authHeader?.startsWith('Bearer ')) {
 return authHeader.substring(7);
 }
 
 // Check for Backstage session cookie
 const backstageCookie = req.cookies.get('backstage-identity')?.value;
 if (backstageCookie) {
 return backstageCookie;
 }
 
 return null;
}

/**
 * Parse entity reference into components
 */
export function parseEntityRef(entityRef: string): {
 kind: string;
 namespace: string;
 name: string;
} {
 const match = entityRef.match(/^([^:]+):([^\/]+)\/(.+)$/);
 if (!match) {
 throw new Error(`Invalid entity reference: ${entityRef}`);
 }
 
 return {
 kind: match[1],
 namespace: match[2],
 name: match[3],
 };
}

/**
 * Get user teams from ownership entity refs
 */
export function getUserTeams(ownershipEntityRefs: string[]): string[] {
 return ownershipEntityRefs
 .filter(ref => ref.startsWith('group:'))
 .map(ref => {
 const { name } = parseEntityRef(ref);
 return name;
 });
}

/**
 * Check if user has permission based on Backstage RBAC
 */
export async function checkBackstagePermission(
 token: string,
 permission: {
 action: string;
 resource?: string;
 }
): Promise<boolean> {
 try {
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 
 const response = await fetch(`${backstageUrl}/api/permission/authorize`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 items: [{
 permission: {
 type: 'basic',
 name: permission.action,
 resourceType: permission.resource,
 },
 }],
 }),
 });
 
 if (!response.ok) {
 console.error('Backstage permission check failed:', response.status);
 return false;
 }
 
 const data = await response.json();
 return data.items?.[0]?.decision === 'ALLOW';
 } catch (error) {
 console.error('Failed to check Backstage permission:', error);
 return false;
 }
}

/**
 * Sync user from Backstage to local database
 */
export async function syncBackstageUser(identity: BackstageIdentity): Promise<{
 id: string;
 email: string;
 name: string;
 role: string;
 teams: string[];
}> {
 const { name: username } = parseEntityRef(identity.userEntityRef);
 const teams = getUserTeams(identity.ownershipEntityRefs);
 
 // Get user details from Backstage catalog
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 const userResponse = await fetch(
 `${backstageUrl}/api/catalog/entities/by-name/user/default/${username}`,
 {
 headers: {
 'Authorization': process.env.BACKSTAGE_API_TOKEN ? `Bearer ${process.env.BACKSTAGE_API_TOKEN}` : '',
 },
 }
 );
 
 let userEntity: any = {};
 if (userResponse.ok) {
 userEntity = await userResponse.json();
 }
 
 // Map to our user structure
 return {
 id: identity.userEntityRef,
 email: userEntity.spec?.profile?.email || `${username}@example.com`,
 name: userEntity.spec?.profile?.displayName || username,
 role: teams.includes('platform-admins') ? 'ADMIN' : 'USER',
 teams,
 };
}

/**
 * Handle OAuth flow initiation
 */
export function initiateBackstageOAuth(req: NextRequest): string {
  const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
  const clientId = process.env.BACKSTAGE_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/backstage/callback`;
  
  if (!clientId) {
    throw new Error('BACKSTAGE_OAUTH_CLIENT_ID not configured');
  }
  
  const state = jwt.sign(
    { 
      timestamp: Date.now(),
      origin: req.nextUrl.searchParams.get('origin') || '/',
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '10m' }
  );
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'profile email openid',
    state,
  });
  
  return `${backstageUrl}/oauth/authorize?${params.toString()}`;
}

/**
 * Handle OAuth callback and token exchange
 */
export async function handleBackstageOAuthCallback(
  code: string,
  state: string
): Promise<{
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    teams: string[];
  };
  redirectTo?: string;
  error?: string;
}> {
  try {
    // Verify state parameter
    const stateData = jwt.verify(state, process.env.JWT_SECRET || 'fallback-secret') as any;
    const now = Date.now();
    
    if (now - stateData.timestamp > 10 * 60 * 1000) { // 10 minutes
      return { success: false, error: 'OAuth state expired' };
    }
    
    // Exchange code for token
    const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
    const clientId = process.env.BACKSTAGE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.BACKSTAGE_OAUTH_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/backstage/callback`;
    
    if (!clientId || !clientSecret) {
      return { success: false, error: 'OAuth not properly configured' };
    }
    
    const tokenResponse = await fetch(`${backstageUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('OAuth token exchange failed:', error);
      return { success: false, error: 'Token exchange failed' };
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    if (!accessToken) {
      return { success: false, error: 'No access token received' };
    }
    
    // Get user info with the token
    const userInfoResponse = await fetch(`${backstageUrl}/api/auth/v1/identity`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!userInfoResponse.ok) {
      return { success: false, error: 'Failed to get user info' };
    }
    
    const userInfo = await userInfoResponse.json();
    const identity = BackstageIdentitySchema.parse(userInfo.identity);
    
    // Sync user data
    const user = await syncBackstageUser(identity);
    
    return {
      success: true,
      token: accessToken,
      user,
      redirectTo: stateData.origin || '/',
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'OAuth callback failed' 
    };
  }
}

/**
 * Refresh Backstage token
 */
export async function refreshBackstageToken(refreshToken: string): Promise<string | null> {
  try {
    const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
    const clientId = process.env.BACKSTAGE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.BACKSTAGE_OAUTH_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return null;
    }
    
    const response = await fetch(`${backstageUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Validate token with enhanced security checks
 */
export async function validateBackstageTokenSecurity(token: string): Promise<{
  valid: boolean;
  payload?: BackstageTokenPayload;
  security: {
    isExpired: boolean;
    isFromTrustedSource: boolean;
    hasValidSignature: boolean;
    hasRequiredScopes: boolean;
  };
}> {
  const security = {
    isExpired: false,
    isFromTrustedSource: false,
    hasValidSignature: false,
    hasRequiredScopes: false,
  };
  
  try {
    // First, decode without verification to check basic structure
    const decoded = jwt.decode(token, { complete: true }) as any;
    
    if (!decoded) {
      return { valid: false, security };
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.exp && decoded.payload.exp < now) {
      security.isExpired = true;
      return { valid: false, security };
    }
    
    // Check issuer if configured
    const trustedIssuers = process.env.BACKSTAGE_TRUSTED_ISSUERS?.split(',') || [];
    if (trustedIssuers.length > 0) {
      security.isFromTrustedSource = trustedIssuers.includes(decoded.payload.iss);
    } else {
      security.isFromTrustedSource = true; // No restriction configured
    }
    
    // Verify signature
    const payload = await verifyBackstageToken(token);
    security.hasValidSignature = !!payload;
    
    if (payload) {
      // Check required scopes/permissions
      const requiredScopes = process.env.BACKSTAGE_REQUIRED_SCOPES?.split(',') || [];
      if (requiredScopes.length > 0) {
        security.hasRequiredScopes = requiredScopes.every(scope => 
          decoded.payload.scope?.includes(scope)
        );
      } else {
        security.hasRequiredScopes = true;
      }
      
      return {
        valid: security.hasValidSignature && 
               security.isFromTrustedSource && 
               security.hasRequiredScopes && 
               !security.isExpired,
        payload,
        security,
      };
    }
    
    return { valid: false, security };
  } catch (error) {
    console.error('Token security validation failed:', error);
    return { valid: false, security };
  }
}

/**
 * Middleware to authenticate with Backstage
 */
export async function authenticateWithBackstage(req: NextRequest): Promise<{
 authenticated: boolean;
 user?: {
 id: string;
 email: string;
 name: string;
 role: string;
 teams: string[];
 };
 error?: string;
}> {
 const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
 const userAgent = req.headers.get('user-agent') || 'unknown';
 
 const token = extractBackstageToken(req);
 
 if (!token) {
 await createAuditLog({
 action: 'backstage.auth.missing_token',
 resource: 'authentication',
 resourceId: null,
 userId: null,
 details: { ipAddress, userAgent },
 status: 'failed',
 });
 
 return {
 authenticated: false,
 error: 'No authentication token provided',
 };
 }
 
 // Enhanced security validation
 const validation = await validateBackstageTokenSecurity(token);
 if (!validation.valid) {
 await createAuditLog({
 action: 'backstage.auth.invalid_token',
 resource: 'authentication',
 resourceId: null,
 userId: null,
 details: { 
 ipAddress, 
 userAgent,
 securityCheck: validation.security,
 },
 status: 'failed',
 });
 
 return {
 authenticated: false,
 error: 'Invalid authentication token',
 };
 }
 
 // Get user identity
 const identity = await getBackstageIdentity(token);
 if (!identity) {
 await createAuditLog({
 action: 'backstage.auth.identity_failed',
 resource: 'authentication',
 resourceId: null,
 userId: null,
 details: { ipAddress, userAgent },
 status: 'failed',
 });
 
 return {
 authenticated: false,
 error: 'Failed to get user identity',
 };
 }
 
 // Sync user data
 const user = await syncBackstageUser(identity);
 
 await createAuditLog({
 action: 'backstage.auth.success',
 resource: 'authentication',
 resourceId: user.id,
 userId: user.id,
 details: { 
 ipAddress, 
 userAgent,
 backstageRef: identity.userEntityRef,
 },
 status: 'success',
 });
 
 return {
 authenticated: true,
 user,
 };
}