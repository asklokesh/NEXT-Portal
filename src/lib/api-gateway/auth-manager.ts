import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';

export interface JWTConfig {
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  secret: string;
  publicKey?: string;
  issuer: string;
  audience: string;
  expirationTime: string;
  refreshExpirationTime: string;
}

export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface APIKey {
  id: string;
  key: string;
  name: string;
  consumerId: string;
  scopes: string[];
  rateLimit: {
    requests: number;
    window: number; // seconds
  };
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

const JWTPayloadSchema = z.object({
  sub: z.string(),
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  iat: z.number(),
  jti: z.string().optional(),
  scope: z.string().optional(),
  roles: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  consumer_id: z.string().optional(),
});

const OAuth2TokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export class AuthManager {
  private redis: Redis;
  private jwtConfig: JWTConfig;
  private oauth2Config: OAuth2Config;

  constructor(
    redis: Redis,
    jwtConfig: JWTConfig,
    oauth2Config: OAuth2Config
  ) {
    this.redis = redis;
    this.jwtConfig = jwtConfig;
    this.oauth2Config = oauth2Config;
  }

  /**
   * Generate JWT token for authenticated user
   */
  async generateJWT(payload: {
    sub: string;
    scope?: string;
    roles?: string[];
    permissions?: string[];
    consumer_id?: string;
    custom?: Record<string, any>;
  }): Promise<{ token: string; refreshToken: string }> {
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      sub: payload.sub,
      iss: this.jwtConfig.issuer,
      aud: this.jwtConfig.audience,
      iat: now,
      exp: now + this.parseTimeToSeconds(this.jwtConfig.expirationTime),
      jti: `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scope: payload.scope,
      roles: payload.roles,
      permissions: payload.permissions,
      consumer_id: payload.consumer_id,
      ...payload.custom,
    };

    const token = jwt.sign(jwtPayload, this.jwtConfig.secret, {
      algorithm: this.jwtConfig.algorithm,
    });

    // Generate refresh token
    const refreshPayload = {
      sub: payload.sub,
      iss: this.jwtConfig.issuer,
      aud: this.jwtConfig.audience,
      iat: now,
      exp: now + this.parseTimeToSeconds(this.jwtConfig.refreshExpirationTime),
      type: 'refresh',
      jti: `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const refreshToken = jwt.sign(refreshPayload, this.jwtConfig.secret, {
      algorithm: this.jwtConfig.algorithm,
    });

    // Store token metadata in Redis
    await this.storeTokenMetadata(jwtPayload.jti!, {
      userId: payload.sub,
      consumerId: payload.consumer_id,
      issuedAt: now,
      expiresAt: jwtPayload.exp,
      scopes: payload.scope?.split(' ') || [],
      roles: payload.roles || [],
    });

    await this.storeTokenMetadata(refreshPayload.jti!, {
      userId: payload.sub,
      consumerId: payload.consumer_id,
      issuedAt: now,
      expiresAt: refreshPayload.exp,
      type: 'refresh',
    });

    return { token, refreshToken };
  }

  /**
   * Verify and decode JWT token
   */
  async verifyJWT(token: string): Promise<{
    valid: boolean;
    payload?: z.infer<typeof JWTPayloadSchema>;
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(token, this.jwtConfig.secret, {
        algorithms: [this.jwtConfig.algorithm],
        issuer: this.jwtConfig.issuer,
        audience: this.jwtConfig.audience,
      });

      const payload = JWTPayloadSchema.parse(decoded);

      // Check if token is blacklisted
      if (payload.jti && await this.isTokenBlacklisted(payload.jti)) {
        return { valid: false, error: 'Token is blacklisted' };
      }

      return { valid: true, payload };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid token' 
      };
    }
  }

  /**
   * Refresh JWT token using refresh token
   */
  async refreshJWT(refreshToken: string): Promise<{
    success: boolean;
    tokens?: { token: string; refreshToken: string };
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtConfig.secret) as any;
      
      if (decoded.type !== 'refresh') {
        return { success: false, error: 'Invalid refresh token' };
      }

      // Check if refresh token is blacklisted
      if (await this.isTokenBlacklisted(decoded.jti)) {
        return { success: false, error: 'Refresh token is blacklisted' };
      }

      // Get user metadata from Redis
      const userMetadata = await this.getTokenMetadata(decoded.jti);
      if (!userMetadata) {
        return { success: false, error: 'Invalid refresh token' };
      }

      // Blacklist old refresh token
      await this.blacklistToken(decoded.jti, decoded.exp);

      // Generate new tokens
      const tokens = await this.generateJWT({
        sub: decoded.sub,
        scope: userMetadata.scopes?.join(' '),
        roles: userMetadata.roles,
        consumer_id: userMetadata.consumerId,
      });

      return { success: true, tokens };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Invalid refresh token' 
      };
    }
  }

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthorizationUrl(state: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.oauth2Config.clientId,
      redirect_uri: this.oauth2Config.redirectUri,
      state,
      scope: (scopes || this.oauth2Config.scopes).join(' '),
    });

    return `${this.oauth2Config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange OAuth2 authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<{
    success: boolean;
    tokens?: z.infer<typeof OAuth2TokenSchema>;
    error?: string;
  }> {
    try {
      const response = await fetch(this.oauth2Config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${this.oauth2Config.clientId}:${this.oauth2Config.clientSecret}`
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.oauth2Config.redirectUri,
        }),
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to exchange code for tokens' };
      }

      const data = await response.json();
      const tokens = OAuth2TokenSchema.parse(data);

      // Store OAuth2 token metadata
      const tokenId = `oauth2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.storeTokenMetadata(tokenId, {
        accessToken: tokens.access_token,
        tokenType: tokens.token_type,
        expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
        refreshToken: tokens.refresh_token,
        scopes: tokens.scope?.split(' ') || [],
        state,
      });

      return { success: true, tokens };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token exchange failed' 
      };
    }
  }

  /**
   * Create API key for consumer
   */
  async createAPIKey(
    consumerId: string,
    name: string,
    scopes: string[],
    rateLimit: { requests: number; window: number },
    expiresAt?: Date
  ): Promise<APIKey> {
    const apiKey: APIKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      key: this.generateSecureKey(),
      name,
      consumerId,
      scopes,
      rateLimit,
      expiresAt,
      isActive: true,
      createdAt: new Date(),
    };

    // Store API key in Redis
    await this.redis.hset(
      `api_key:${apiKey.key}`,
      'data',
      JSON.stringify(apiKey)
    );

    // Set expiration if specified
    if (expiresAt) {
      await this.redis.expireat(
        `api_key:${apiKey.key}`,
        Math.floor(expiresAt.getTime() / 1000)
      );
    }

    return apiKey;
  }

  /**
   * Validate API key
   */
  async validateAPIKey(key: string): Promise<{
    valid: boolean;
    apiKey?: APIKey;
    error?: string;
  }> {
    try {
      const data = await this.redis.hget(`api_key:${key}`, 'data');
      if (!data) {
        return { valid: false, error: 'API key not found' };
      }

      const apiKey: APIKey = JSON.parse(data);

      if (!apiKey.isActive) {
        return { valid: false, error: 'API key is disabled' };
      }

      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        return { valid: false, error: 'API key has expired' };
      }

      // Update last used timestamp
      apiKey.lastUsedAt = new Date();
      await this.redis.hset(
        `api_key:${key}`,
        'data',
        JSON.stringify(apiKey)
      );

      return { valid: true, apiKey };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'API key validation failed' 
      };
    }
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(apiKey: APIKey): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const key = `rate_limit:${apiKey.key}`;
    const current = await this.redis.get(key);
    const requests = parseInt(current || '0');

    if (requests >= apiKey.rateLimit.requests) {
      const ttl = await this.redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + (ttl * 1000),
      };
    }

    await this.redis.incr(key);
    if (requests === 0) {
      await this.redis.expire(key, apiKey.rateLimit.window);
    }

    return {
      allowed: true,
      remaining: apiKey.rateLimit.requests - requests - 1,
      resetTime: Date.now() + (apiKey.rateLimit.window * 1000),
    };
  }

  /**
   * Blacklist token
   */
  async blacklistToken(jti: string, exp: number): Promise<void> {
    const ttl = Math.max(0, exp - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      await this.redis.setex(`blacklist:${jti}`, ttl, 'blacklisted');
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${jti}`);
    return result === 'blacklisted';
  }

  /**
   * Store token metadata
   */
  private async storeTokenMetadata(jti: string, metadata: any): Promise<void> {
    await this.redis.hset(
      `token_meta:${jti}`,
      'data',
      JSON.stringify(metadata)
    );
    
    // Set expiration based on token expiry
    if (metadata.expiresAt) {
      const ttl = Math.max(0, metadata.expiresAt - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await this.redis.expire(`token_meta:${jti}`, ttl);
      }
    }
  }

  /**
   * Get token metadata
   */
  private async getTokenMetadata(jti: string): Promise<any> {
    const data = await this.redis.hget(`token_meta:${jti}`, 'data');
    return data ? JSON.parse(data) : null;
  }

  /**
   * Generate secure API key
   */
  private generateSecureKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Parse time string to seconds
   */
  private parseTimeToSeconds(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid time format: ${timeStr}`);

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: throw new Error(`Unsupported time unit: ${unit}`);
    }
  }
}

/**
 * Authorization middleware for checking permissions
 */
export class AuthorizationManager {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Check if user has required permissions
   */
  async checkPermissions(
    userId: string,
    requiredPermissions: string[]
  ): Promise<{ authorized: boolean; missingPermissions?: string[] }> {
    const userPermissions = await this.getUserPermissions(userId);
    const missingPermissions = requiredPermissions.filter(
      perm => !userPermissions.includes(perm)
    );

    return {
      authorized: missingPermissions.length === 0,
      missingPermissions: missingPermissions.length > 0 ? missingPermissions : undefined,
    };
  }

  /**
   * Check if user has required roles
   */
  async checkRoles(
    userId: string,
    requiredRoles: string[]
  ): Promise<{ authorized: boolean; missingRoles?: string[] }> {
    const userRoles = await this.getUserRoles(userId);
    const missingRoles = requiredRoles.filter(
      role => !userRoles.includes(role)
    );

    return {
      authorized: missingRoles.length === 0,
      missingRoles: missingRoles.length > 0 ? missingRoles : undefined,
    };
  }

  /**
   * Get user permissions from cache or database
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    const cached = await this.redis.get(`user_permissions:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // In a real implementation, this would fetch from database
    // For now, return default permissions
    const permissions: string[] = [];
    
    // Cache for 5 minutes
    await this.redis.setex(
      `user_permissions:${userId}`,
      300,
      JSON.stringify(permissions)
    );

    return permissions;
  }

  /**
   * Get user roles from cache or database
   */
  private async getUserRoles(userId: string): Promise<string[]> {
    const cached = await this.redis.get(`user_roles:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // In a real implementation, this would fetch from database
    // For now, return default roles
    const roles: string[] = [];
    
    // Cache for 5 minutes
    await this.redis.setex(
      `user_roles:${userId}`,
      300,
      JSON.stringify(roles)
    );

    return roles;
  }
}