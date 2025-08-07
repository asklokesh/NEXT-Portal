/* eslint-disable @typescript-eslint/no-unused-vars */
import crypto from 'crypto';
import { prisma } from '../db/client';
import { redis } from '../db/client';

export interface APIKey {
 id: string;
 name: string;
 key: string;
 hashedKey: string;
 userId: string;
 teamId?: string;
 permissions: string[];
 rateLimit: number; // requests per hour
 expiresAt?: Date;
 lastUsedAt?: Date;
 createdAt: Date;
 updatedAt: Date;
 isActive: boolean;
}

export class APIKeyManager {
 private readonly KEY_PREFIX = 'idp_';
 private readonly KEY_LENGTH = 32;
 private readonly CACHE_TTL = 3600; // 1 hour

 /**
 * Generate a new API key
 */
 async generateAPIKey(
 userId: string,
 name: string,
 permissions: string[],
 expiresInDays?: number,
 teamId?: string
 ): Promise<{ key: string; apiKey: APIKey }> {
 // Generate random key
 const keyBuffer = crypto.randomBytes(this.KEY_LENGTH);
 const key = this.KEY_PREFIX + keyBuffer.toString('base64url');
 
 // Hash the key for storage
 const hashedKey = this.hashKey(key);

 // Create expiration date
 const expiresAt = expiresInDays 
 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
 : undefined;

 // Store in database
 const apiKey = await prisma.aPIKey.create({
 data: {
 name,
 hashedKey,
 userId,
 teamId,
 permissions,
 rateLimit: 1000, // Default 1000 requests per hour
 expiresAt,
 isActive: true,
 },
 });

 // Cache the key data
 await this.cacheAPIKey(hashedKey, {
 id: apiKey.id,
 userId: apiKey.userId,
 teamId: apiKey.teamId || undefined,
 permissions: apiKey.permissions,
 rateLimit: apiKey.rateLimit,
 expiresAt: apiKey.expiresAt || undefined,
 });

 return {
 key,
 apiKey: {
 ...apiKey,
 key, // Return the unhashed key only during creation
 },
 };
 }

 /**
 * Validate an API key
 */
 async validateAPIKey(key: string): Promise<{
 valid: boolean;
 apiKey?: APIKey;
 error?: string;
 }> {
 if (!key.startsWith(this.KEY_PREFIX)) {
 return { valid: false, error: 'Invalid key format' };
 }

 const hashedKey = this.hashKey(key);

 // Check cache first
 const cached = await this.getCachedAPIKey(hashedKey);
 if (cached) {
 // Validate expiration
 if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
 return { valid: false, error: 'Key expired' };
 }

 // Update last used timestamp asynchronously
 this.updateLastUsed(cached.id).catch(console.error);

 return {
 valid: true,
 apiKey: cached as APIKey,
 };
 }

 // Fallback to database
 const apiKey = await prisma.aPIKey.findUnique({
 where: { hashedKey },
 include: {
 user: true,
 team: true,
 },
 });

 if (!apiKey) {
 return { valid: false, error: 'Invalid key' };
 }

 if (!apiKey.isActive) {
 return { valid: false, error: 'Key is inactive' };
 }

 if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
 return { valid: false, error: 'Key expired' };
 }

 // Cache for future requests
 await this.cacheAPIKey(hashedKey, {
 id: apiKey.id,
 userId: apiKey.userId,
 teamId: apiKey.teamId || undefined,
 permissions: apiKey.permissions,
 rateLimit: apiKey.rateLimit,
 expiresAt: apiKey.expiresAt || undefined,
 });

 // Update last used
 this.updateLastUsed(apiKey.id).catch(console.error);

 return {
 valid: true,
 apiKey: {
 ...apiKey,
 key: '', // Never return the actual key
 },
 };
 }

 /**
 * Rotate an API key
 */
 async rotateAPIKey(apiKeyId: string): Promise<{ key: string; apiKey: APIKey }> {
 const existingKey = await prisma.aPIKey.findUnique({
 where: { id: apiKeyId },
 });

 if (!existingKey) {
 throw new Error('API key not found');
 }

 // Deactivate old key
 await prisma.aPIKey.update({
 where: { id: apiKeyId },
 data: { isActive: false },
 });

 // Invalidate cache
 await this.invalidateCachedAPIKey(existingKey.hashedKey);

 // Generate new key with same permissions
 return this.generateAPIKey(
 existingKey.userId,
 `${existingKey.name} (rotated)`,
 existingKey.permissions,
 existingKey.expiresAt ? Math.ceil((existingKey.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : undefined,
 existingKey.teamId || undefined
 );
 }

 /**
 * Revoke an API key
 */
 async revokeAPIKey(apiKeyId: string): Promise<void> {
 const apiKey = await prisma.aPIKey.update({
 where: { id: apiKeyId },
 data: { isActive: false },
 });

 // Invalidate cache
 await this.invalidateCachedAPIKey(apiKey.hashedKey);
 }

 /**
 * List API keys for a user
 */
 async listUserAPIKeys(userId: string): Promise<APIKey[]> {
 const keys = await prisma.aPIKey.findMany({
 where: { userId },
 orderBy: { createdAt: 'desc' },
 });

 return keys.map(key => ({
 ...key,
 key: '', // Never return actual keys
 }));
 }

 /**
 * Check rate limit for API key
 */
 async checkRateLimit(apiKeyId: string, limit: number): Promise<{
 allowed: boolean;
 remaining: number;
 resetAt: Date;
 }> {
 const now = new Date();
 const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
 const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);
 
 const key = `rate_limit:${apiKeyId}:${windowStart.getTime()}`;
 
 // Increment counter
 const count = await redis.incr(key);
 
 // Set expiry on first request
 if (count === 1) {
 await redis.expire(key, 3600);
 }
 
 const allowed = count <= limit;
 const remaining = Math.max(0, limit - count);
 
 return {
 allowed,
 remaining,
 resetAt: windowEnd,
 };
 }

 /**
 * Create API key middleware
 */
 createAPIKeyMiddleware() {
 return async (req: any, res: any, next: any) => {
 const apiKey = req.headers['x-api-key'] || req.query.api_key;
 
 if (!apiKey) {
 return next(); // Let other auth methods handle
 }

 const validation = await this.validateAPIKey(apiKey);
 
 if (!validation.valid) {
 return res.status(401).json({ error: validation.error });
 }

 // Check rate limit
 const rateLimit = await this.checkRateLimit(
 validation.apiKey!.id,
 validation.apiKey!.rateLimit
 );

 if (!rateLimit.allowed) {
 res.setHeader('X-RateLimit-Limit', validation.apiKey!.rateLimit);
 res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
 res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());
 
 return res.status(429).json({
 error: 'Rate limit exceeded',
 resetAt: rateLimit.resetAt,
 });
 }

 // Set rate limit headers
 res.setHeader('X-RateLimit-Limit', validation.apiKey!.rateLimit);
 res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
 res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());

 // Attach API key info to request
 req.apiKey = validation.apiKey;
 req.user = {
 id: validation.apiKey!.userId,
 teamId: validation.apiKey!.teamId,
 permissions: validation.apiKey!.permissions,
 authMethod: 'api_key',
 };

 next();
 };
 }

 /**
 * Hash an API key
 */
 private hashKey(key: string): string {
 return crypto.createHash('sha256').update(key).digest('hex');
 }

 /**
 * Cache API key data
 */
 private async cacheAPIKey(hashedKey: string, data: any): Promise<void> {
 await redis.setex(
 `api_key:${hashedKey}`,
 this.CACHE_TTL,
 JSON.stringify(data)
 );
 }

 /**
 * Get cached API key data
 */
 private async getCachedAPIKey(hashedKey: string): Promise<any | null> {
 const cached = await redis.get(`api_key:${hashedKey}`);
 return cached ? JSON.parse(cached) : null;
 }

 /**
 * Invalidate cached API key
 */
 private async invalidateCachedAPIKey(hashedKey: string): Promise<void> {
 await redis.del(`api_key:${hashedKey}`);
 }

 /**
 * Update last used timestamp
 */
 private async updateLastUsed(apiKeyId: string): Promise<void> {
 await prisma.aPIKey.update({
 where: { id: apiKeyId },
 data: { lastUsedAt: new Date() },
 });
 }

 /**
 * Clean up expired API keys
 */
 async cleanupExpiredKeys(): Promise<number> {
 const result = await prisma.aPIKey.updateMany({
 where: {
 expiresAt: { lt: new Date() },
 isActive: true,
 },
 data: { isActive: false },
 });

 return result.count;
 }
}

// Create singleton instance
export const apiKeyManager = new APIKeyManager();