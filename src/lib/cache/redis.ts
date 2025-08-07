import { Redis } from 'ioredis';

// Redis client configuration
const redisConfig = {
 host: process.env.REDIS_HOST || 'localhost',
 port: parseInt(process.env.REDIS_PORT || '6379'),
 password: process.env.REDIS_PASSWORD,
 db: parseInt(process.env.REDIS_DB || '0'),
 retryStrategy: (times: number) => {
 const delay = Math.min(times * 50, 2000);
 return delay;
 },
 maxRetriesPerRequest: 3,
 enableReadyCheck: true,
 enableOfflineQueue: true,
};

// Create Redis client with error handling
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
 if (!process.env.REDIS_HOST) {
 console.log('Redis not configured, using in-memory cache');
 return null;
 }

 if (!redis) {
 try {
 redis = new Redis(redisConfig);
 
 redis.on('error', (err) => {
 console.error('Redis error:', err);
 });

 redis.on('connect', () => {
 console.log('Redis connected successfully');
 });

 redis.on('ready', () => {
 console.log('Redis ready to accept commands');
 });
 } catch (error) {
 console.error('Failed to create Redis client:', error);
 return null;
 }
 }

 return redis;
}

// In-memory fallback cache
const memoryCache = new Map<string, { value: any; expiry: number }>();

// Clean up expired entries
setInterval(() => {
 const now = Date.now();
 for (const [key, data] of memoryCache.entries()) {
 if (data.expiry < now) {
 memoryCache.delete(key);
 }
 }
}, 60 * 1000); // Every minute

export class CacheService {
 private static instance: CacheService;
 private redis: Redis | null;

 private constructor() {
 this.redis = getRedisClient();
 }

 static getInstance(): CacheService {
 if (!CacheService.instance) {
 CacheService.instance = new CacheService();
 }
 return CacheService.instance;
 }

 /**
 * Get value from cache
 */
 async get<T>(key: string): Promise<T | null> {
 try {
 if (this.redis) {
 const value = await this.redis.get(key);
 return value ? JSON.parse(value) : null;
 } else {
 // Fallback to memory cache
 const cached = memoryCache.get(key);
 if (cached && cached.expiry > Date.now()) {
 return cached.value;
 }
 memoryCache.delete(key);
 return null;
 }
 } catch (error) {
 console.error('Cache get error:', error);
 return null;
 }
 }

 /**
 * Set value in cache with TTL (in seconds)
 */
 async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
 try {
 const serialized = JSON.stringify(value);
 
 if (this.redis) {
 await this.redis.setex(key, ttl, serialized);
 } else {
 // Fallback to memory cache
 memoryCache.set(key, {
 value,
 expiry: Date.now() + (ttl * 1000)
 });
 }
 } catch (error) {
 console.error('Cache set error:', error);
 }
 }

 /**
 * Delete value from cache
 */
 async del(key: string): Promise<void> {
 try {
 if (this.redis) {
 await this.redis.del(key);
 } else {
 memoryCache.delete(key);
 }
 } catch (error) {
 console.error('Cache delete error:', error);
 }
 }

 /**
 * Delete all keys matching a pattern
 */
 async delPattern(pattern: string): Promise<void> {
 try {
 if (this.redis) {
 const keys = await this.redis.keys(pattern);
 if (keys.length > 0) {
 await this.redis.del(...keys);
 }
 } else {
 // Fallback for memory cache
 const regex = new RegExp(pattern.replace('*', '.*'));
 for (const key of memoryCache.keys()) {
 if (regex.test(key)) {
 memoryCache.delete(key);
 }
 }
 }
 } catch (error) {
 console.error('Cache delete pattern error:', error);
 }
 }

 /**
 * Check if key exists
 */
 async exists(key: string): Promise<boolean> {
 try {
 if (this.redis) {
 return (await this.redis.exists(key)) === 1;
 } else {
 const cached = memoryCache.get(key);
 return cached ? cached.expiry > Date.now() : false;
 }
 } catch (error) {
 console.error('Cache exists error:', error);
 return false;
 }
 }

 /**
 * Get remaining TTL for a key
 */
 async ttl(key: string): Promise<number> {
 try {
 if (this.redis) {
 return await this.redis.ttl(key);
 } else {
 const cached = memoryCache.get(key);
 if (cached && cached.expiry > Date.now()) {
 return Math.floor((cached.expiry - Date.now()) / 1000);
 }
 return -1;
 }
 } catch (error) {
 console.error('Cache TTL error:', error);
 return -1;
 }
 }

 /**
 * Increment a counter
 */
 async incr(key: string, ttl?: number): Promise<number> {
 try {
 if (this.redis) {
 const result = await this.redis.incr(key);
 if (ttl) {
 await this.redis.expire(key, ttl);
 }
 return result;
 } else {
 // Fallback for memory cache
 const current = (await this.get<number>(key)) || 0;
 const newValue = current + 1;
 await this.set(key, newValue, ttl);
 return newValue;
 }
 } catch (error) {
 console.error('Cache increment error:', error);
 return 0;
 }
 }

 /**
 * Set hash field
 */
 async hset(key: string, field: string, value: any, ttl?: number): Promise<void> {
 try {
 if (this.redis) {
 await this.redis.hset(key, field, JSON.stringify(value));
 if (ttl) {
 await this.redis.expire(key, ttl);
 }
 } else {
 // Fallback for memory cache
 const hash = (await this.get<Record<string, any>>(key)) || {};
 hash[field] = value;
 await this.set(key, hash, ttl);
 }
 } catch (error) {
 console.error('Cache hset error:', error);
 }
 }

 /**
 * Get hash field
 */
 async hget<T>(key: string, field: string): Promise<T | null> {
 try {
 if (this.redis) {
 const value = await this.redis.hget(key, field);
 return value ? JSON.parse(value) : null;
 } else {
 // Fallback for memory cache
 const hash = await this.get<Record<string, any>>(key);
 return hash?.[field] || null;
 }
 } catch (error) {
 console.error('Cache hget error:', error);
 return null;
 }
 }

 /**
 * Get all hash fields
 */
 async hgetall<T = Record<string, any>>(key: string): Promise<T | null> {
 try {
 if (this.redis) {
 const hash = await this.redis.hgetall(key);
 const result: any = {};
 for (const [field, value] of Object.entries(hash)) {
 result[field] = JSON.parse(value);
 }
 return result;
 } else {
 // Fallback for memory cache
 return await this.get<T>(key);
 }
 } catch (error) {
 console.error('Cache hgetall error:', error);
 return null;
 }
 }

 /**
 * Close Redis connection
 */
 async close(): Promise<void> {
 if (this.redis) {
 await this.redis.quit();
 }
 }
}

// Export singleton instance
export const cache = CacheService.getInstance();

// Cache key generators
export const cacheKeys = {
 // Service catalog
 service: (id: string) => `service:${id}`,
 serviceList: (filters?: string) => `services:list:${filters || 'all'}`,
 serviceRelations: (id: string) => `service:${id}:relations`,
 serviceMetrics: (id: string) => `service:${id}:metrics`,
 
 // Templates
 template: (id: string) => `template:${id}`,
 templateList: (filters?: string) => `templates:list:${filters || 'all'}`,
 templateUsage: (id: string) => `template:${id}:usage`,
 
 // Costs
 costs: (provider: string, period: string) => `costs:${provider}:${period}`,
 costSummary: (period: string) => `costs:summary:${period}`,
 costRecommendations: () => `costs:recommendations`,
 
 // User preferences
 userPrefs: (userId: string) => `user:${userId}:prefs`,
 userSession: (sessionId: string) => `session:${sessionId}`,
 
 // API responses
 apiResponse: (endpoint: string, params?: string) => `api:${endpoint}:${params || ''}`,
 
 // Rate limiting
 rateLimit: (key: string) => `ratelimit:${key}`,
 
 // Health checks
 health: (service: string) => `health:${service}`,
 
 // Analytics
 analytics: (metric: string, period: string) => `analytics:${metric}:${period}`,
};