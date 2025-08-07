/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-only';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
 userId: string;
 email: string;
 role: string;
 iat?: number;
 exp?: number;
}

export interface TokenPair {
 accessToken: string;
 refreshToken: string;
 expiresIn: number;
}

/**
 * Generate JWT tokens for a user
 */
export const generateTokens = (user: User): TokenPair => {
 const payload: JWTPayload = {
 userId: user.id,
 email: user.email,
 role: user.role,
 };

 const accessToken = jwt.sign(payload, JWT_SECRET, {
 expiresIn: JWT_EXPIRES_IN,
 issuer: 'backstage-idp-wrapper',
 audience: 'backstage-idp-wrapper',
 });

 const refreshToken = jwt.sign(
 { userId: user.id },
 JWT_SECRET,
 {
 expiresIn: '30d',
 issuer: 'backstage-idp-wrapper',
 audience: 'backstage-idp-wrapper',
 }
 );

 // Calculate expiration time in seconds
 const decoded = jwt.decode(accessToken) as any;
 const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

 return {
 accessToken,
 refreshToken,
 expiresIn,
 };
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token: string): JWTPayload | null => {
 try {
 const decoded = jwt.verify(token, JWT_SECRET, {
 issuer: 'backstage-idp-wrapper',
 audience: 'backstage-idp-wrapper',
 }) as JWTPayload;

 return decoded;
 } catch (error) {
 console.error('JWT verification failed:', error);
 return null;
 }
};

/**
 * Decode JWT token without verification (for expired tokens)
 */
export const decodeToken = (token: string): JWTPayload | null => {
 try {
 const decoded = jwt.decode(token) as JWTPayload;
 return decoded;
 } catch (error) {
 console.error('JWT decode failed:', error);
 return null;
 }
};

/**
 * Check if JWT token is expired
 */
export const isTokenExpired = (token: string): boolean => {
 try {
 const decoded = jwt.decode(token) as any;
 if (!decoded || !decoded.exp) {
 return true;
 }

 const currentTime = Math.floor(Date.now() / 1000);
 return decoded.exp < currentTime;
 } catch (error) {
 return true;
 }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader: string | null): string | null => {
 if (!authHeader) {
 return null;
 }

 const parts = authHeader.split(' ');
 if (parts.length !== 2 || parts[0] !== 'Bearer') {
 return null;
 }

 return parts[1];
};

/**
 * Generate API key
 */
export const generateApiKey = (): string => {
 const prefix = 'bk_';
 const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)))
 .map(b => b.toString(16).padStart(2, '0'))
 .join('');
 
 return `${prefix}${randomBytes}`;
};

/**
 * Hash API key for storage
 */
export const hashApiKey = async (apiKey: string): Promise<string> => {
 const bcrypt = await import('bcryptjs');
 const saltRounds = parseInt(process.env.HASH_SALT_ROUNDS || '12');
 return bcrypt.hash(apiKey, saltRounds);
};

/**
 * Verify API key against hash
 */
export const verifyApiKey = async (apiKey: string, hash: string): Promise<boolean> => {
 try {
 const bcrypt = await import('bcryptjs');
 return bcrypt.compare(apiKey, hash);
 } catch (error) {
 console.error('API key verification failed:', error);
 return false;
 }
};