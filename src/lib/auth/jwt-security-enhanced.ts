/**
 * Enhanced JWT Security Module
 * Fixes algorithm confusion, race conditions, and token lifecycle vulnerabilities
 */

import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload, decodeJwt } from 'jose';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache';

// Security Configuration
const JWT_ALGORITHMS = {
  ACCESS_TOKEN: 'RS256' as const,  // Using asymmetric for better security
  REFRESH_TOKEN: 'RS256' as const,
  ID_TOKEN: 'RS256' as const
};

const TOKEN_EXPIRY = {
  ACCESS_TOKEN: 15 * 60,        // 15 minutes in seconds
  REFRESH_TOKEN: 7 * 24 * 60 * 60,  // 7 days in seconds
  ID_TOKEN: 60 * 60,            // 1 hour in seconds
  SESSION: 24 * 60 * 60         // 24 hours in seconds
};

// Token blacklist for revoked tokens (in production, use Redis)
const tokenBlacklist = new LRUCache<string, boolean>({
  max: 10000,
  ttl: TOKEN_EXPIRY.REFRESH_TOKEN * 1000 // TTL in milliseconds
});

// Token usage tracking to prevent replay attacks
const tokenUsageTracker = new LRUCache<string, number>({
  max: 10000,
  ttl: TOKEN_EXPIRY.ACCESS_TOKEN * 1000
});

// Session version tracking for concurrent session management
const sessionVersions = new Map<string, number>();

// Mutex for preventing race conditions
class AsyncMutex {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    
    let releaseFn: () => void;
    const promise = new Promise<void>((resolve) => {
      releaseFn = () => {
        this.locks.delete(key);
        resolve();
      };
    });
    
    this.locks.set(key, promise);
    return releaseFn!;
  }
}

const mutex = new AsyncMutex();

// Enhanced token payload with security features
export interface SecureTokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
  sessionId: string;
  sessionVersion: number;
  tokenType: 'access' | 'refresh' | 'id';
  fingerprint?: string;  // Device fingerprint for additional validation
  nonce?: string;        // One-time use nonce
  azp?: string;          // Authorized party (client ID)
  scope?: string;        // OAuth scopes
  amr?: string[];        // Authentication methods used
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: SecureTokenPayload;
  error?: string;
  errorCode?: string;
}

export interface TokenGenerationOptions {
  includePermissions?: boolean;
  deviceFingerprint?: string;
  clientId?: string;
  scope?: string;
  authMethods?: string[];
}

class JWTSecurityManager {
  private static instance: JWTSecurityManager;
  private privateKey: crypto.KeyObject | null = null;
  private publicKey: crypto.KeyObject | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): JWTSecurityManager {
    if (!JWTSecurityManager.instance) {
      JWTSecurityManager.instance = new JWTSecurityManager();
    }
    return JWTSecurityManager.instance;
  }

  /**
   * Initialize JWT manager with RSA keys
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const release = await mutex.acquire('jwt-init');
    try {
      if (this.initialized) return;

      // In production, load from secure key management service
      // For now, generate keys if not provided
      if (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY) {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        
        this.privateKey = crypto.createPrivateKey(privateKey);
        this.publicKey = crypto.createPublicKey(publicKey);
      } else {
        this.privateKey = await importPKCS8(process.env.JWT_PRIVATE_KEY, JWT_ALGORITHMS.ACCESS_TOKEN);
        this.publicKey = await importSPKI(process.env.JWT_PUBLIC_KEY, JWT_ALGORITHMS.ACCESS_TOKEN);
      }

      this.initialized = true;
    } finally {
      release();
    }
  }

  /**
   * Generate secure access token with race condition protection
   */
  async generateAccessToken(
    userId: string,
    email: string,
    role: string,
    sessionId: string,
    options: TokenGenerationOptions = {}
  ): Promise<string> {
    await this.initialize();
    
    // Acquire lock to prevent race conditions in token generation
    const release = await mutex.acquire(`token-gen:${userId}:${sessionId}`);
    
    try {
      // Get or initialize session version
      const sessionKey = `${userId}:${sessionId}`;
      let sessionVersion = sessionVersions.get(sessionKey) || 0;
      sessionVersion++;
      sessionVersions.set(sessionKey, sessionVersion);

      const jti = crypto.randomUUID();
      const nonce = crypto.randomBytes(16).toString('hex');
      
      const payload: SecureTokenPayload = {
        userId,
        email,
        role,
        permissions: options.includePermissions ? await this.getUserPermissions(userId, role) : undefined,
        sessionId,
        sessionVersion,
        tokenType: 'access',
        fingerprint: options.deviceFingerprint,
        nonce,
        azp: options.clientId,
        scope: options.scope,
        amr: options.authMethods,
        jti,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY.ACCESS_TOKEN,
        iss: process.env.JWT_ISSUER || 'saas-idp',
        aud: process.env.JWT_AUDIENCE || 'saas-idp-api',
        sub: userId
      };

      const token = await new SignJWT(payload as any)
        .setProtectedHeader({ 
          alg: JWT_ALGORITHMS.ACCESS_TOKEN,
          typ: 'JWT',
          kid: process.env.JWT_KEY_ID || 'default'
        })
        .sign(this.privateKey!);

      // Track token issuance
      tokenUsageTracker.set(jti, 0);

      return token;
    } finally {
      release();
    }
  }

  /**
   * Generate secure refresh token
   */
  async generateRefreshToken(
    userId: string,
    sessionId: string,
    deviceFingerprint?: string
  ): Promise<string> {
    await this.initialize();
    
    const release = await mutex.acquire(`refresh-gen:${userId}:${sessionId}`);
    
    try {
      const jti = crypto.randomUUID();
      const sessionKey = `${userId}:${sessionId}`;
      const sessionVersion = sessionVersions.get(sessionKey) || 0;
      
      const payload: SecureTokenPayload = {
        userId,
        email: '', // Minimal info in refresh token
        role: '',
        sessionId,
        sessionVersion,
        tokenType: 'refresh',
        fingerprint: deviceFingerprint,
        jti,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY.REFRESH_TOKEN,
        iss: process.env.JWT_ISSUER || 'saas-idp',
        aud: process.env.JWT_AUDIENCE || 'saas-idp-api',
        sub: userId
      };

      const token = await new SignJWT(payload as any)
        .setProtectedHeader({ 
          alg: JWT_ALGORITHMS.REFRESH_TOKEN,
          typ: 'JWT',
          kid: process.env.JWT_KEY_ID || 'default'
        })
        .sign(this.privateKey!);

      return token;
    } finally {
      release();
    }
  }

  /**
   * Verify token with comprehensive security checks
   */
  async verifyToken(
    token: string,
    expectedType: 'access' | 'refresh' | 'id',
    options: {
      deviceFingerprint?: string;
      checkReplay?: boolean;
      validateSession?: boolean;
    } = {}
  ): Promise<TokenValidationResult> {
    await this.initialize();

    try {
      // Check if token is blacklisted
      const decodedHeader = this.decodeTokenHeader(token);
      if (!decodedHeader) {
        return { valid: false, error: 'Invalid token format', errorCode: 'INVALID_FORMAT' };
      }

      // Verify algorithm to prevent algorithm confusion attacks
      const expectedAlg = JWT_ALGORITHMS[expectedType.toUpperCase() as keyof typeof JWT_ALGORITHMS];
      if (decodedHeader.alg !== expectedAlg) {
        return { 
          valid: false, 
          error: 'Algorithm mismatch - potential algorithm confusion attack', 
          errorCode: 'ALGORITHM_MISMATCH' 
        };
      }

      // Verify token signature and claims
      const { payload } = await jwtVerify(token, this.publicKey!, {
        issuer: process.env.JWT_ISSUER || 'saas-idp',
        audience: process.env.JWT_AUDIENCE || 'saas-idp-api',
        algorithms: [expectedAlg]
      });

      const securePayload = payload as SecureTokenPayload;

      // Check if token is blacklisted
      if (securePayload.jti && tokenBlacklist.has(securePayload.jti)) {
        return { valid: false, error: 'Token has been revoked', errorCode: 'TOKEN_REVOKED' };
      }

      // Verify token type
      if (securePayload.tokenType !== expectedType) {
        return { valid: false, error: 'Invalid token type', errorCode: 'INVALID_TYPE' };
      }

      // Check device fingerprint if provided
      if (options.deviceFingerprint && securePayload.fingerprint) {
        if (securePayload.fingerprint !== options.deviceFingerprint) {
          return { valid: false, error: 'Device fingerprint mismatch', errorCode: 'FINGERPRINT_MISMATCH' };
        }
      }

      // Check for replay attacks on access tokens
      if (options.checkReplay && expectedType === 'access' && securePayload.jti) {
        const usageCount = tokenUsageTracker.get(securePayload.jti) || 0;
        if (usageCount > 0 && securePayload.nonce) {
          // One-time use token has been used
          return { valid: false, error: 'Token replay detected', errorCode: 'REPLAY_ATTACK' };
        }
        tokenUsageTracker.set(securePayload.jti, usageCount + 1);
      }

      // Validate session version to handle concurrent session updates
      if (options.validateSession && securePayload.sessionId) {
        const sessionKey = `${securePayload.userId}:${securePayload.sessionId}`;
        const currentVersion = sessionVersions.get(sessionKey);
        
        if (currentVersion && securePayload.sessionVersion < currentVersion) {
          return { 
            valid: false, 
            error: 'Outdated session version - potential race condition', 
            errorCode: 'OUTDATED_SESSION' 
          };
        }
      }

      // Additional time-based validation
      const now = Math.floor(Date.now() / 1000);
      const clockSkew = 30; // 30 seconds clock skew tolerance

      if (securePayload.iat && securePayload.iat > now + clockSkew) {
        return { valid: false, error: 'Token issued in the future', errorCode: 'INVALID_IAT' };
      }

      if (securePayload.nbf && securePayload.nbf > now + clockSkew) {
        return { valid: false, error: 'Token not yet valid', errorCode: 'TOKEN_NOT_VALID_YET' };
      }

      return { valid: true, payload: securePayload };

    } catch (error: any) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        return { valid: false, error: 'Token has expired', errorCode: 'TOKEN_EXPIRED' };
      }
      if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
        return { valid: false, error: 'Invalid token signature', errorCode: 'INVALID_SIGNATURE' };
      }
      
      console.error('Token verification error:', error);
      return { valid: false, error: 'Token verification failed', errorCode: 'VERIFICATION_FAILED' };
    }
  }

  /**
   * Revoke token (add to blacklist)
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = decodeJwt(token);
      if (decoded.jti) {
        tokenBlacklist.set(decoded.jti as string, true);
      }
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }
  }

  /**
   * Revoke all tokens for a session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = `${userId}:${sessionId}`;
    // Increment session version to invalidate all existing tokens
    const currentVersion = sessionVersions.get(sessionKey) || 0;
    sessionVersions.set(sessionKey, currentVersion + 1000); // Large increment to ensure invalidation
  }

  /**
   * Clean up expired sessions
   */
  async cleanupSessions(): Promise<void> {
    const now = Date.now();
    for (const [key, version] of sessionVersions.entries()) {
      // Remove sessions older than refresh token expiry
      // In production, track session creation time properly
      if (version < 0) { // Placeholder logic
        sessionVersions.delete(key);
      }
    }
  }

  /**
   * Decode token header without verification
   */
  private decodeTokenHeader(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf-8')
      );
      return header;
    } catch {
      return null;
    }
  }

  /**
   * Get user permissions (mock implementation)
   */
  private async getUserPermissions(userId: string, role: string): Promise<string[]> {
    // In production, fetch from database or permission service
    const rolePermissions: Record<string, string[]> = {
      admin: ['read:all', 'write:all', 'delete:all', 'admin:all'],
      developer: ['read:all', 'write:code', 'delete:own'],
      user: ['read:public', 'write:own'],
    };
    
    return rolePermissions[role] || [];
  }

  /**
   * Generate secure session ID
   */
  generateSessionId(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(userAgent: string, acceptLanguage: string, acceptEncoding: string): string {
    const data = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// Export singleton instance
export const jwtSecurity = JWTSecurityManager.getInstance();

// Export types
export type { JWTSecurityManager };