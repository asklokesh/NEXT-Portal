/* eslint-disable @typescript-eslint/no-misused-promises */

// Server-only database client - wrapped to prevent client-side imports
let prisma: any;
let redis: any;
let sessionRedis: any;

if (typeof window === 'undefined') {
  // Server-side only imports
  const { PrismaClient } = require('@prisma/client');
  const Redis = require('ioredis');
  const { mockPrisma, mockRedis, mockSessionRedis } = require('./mock-client');

  // Extend the global object to include prisma for development hot reloading
  declare global {
   // eslint-disable-next-line no-var
   var __prisma: PrismaClient | undefined;
   // eslint-disable-next-line no-var
   var __redis: Redis | undefined;
  }

  // Check if we should use mock mode
  const USE_MOCK = process.env.USE_MOCK_DB === 'true' || !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost:5121');

  // Database connection with connection pooling and optimization
  try {
   if (USE_MOCK) {
   console.log('Using mock database client');
   prisma = mockPrisma;
   } else {
   prisma = globalThis.__prisma ?? new PrismaClient({
 log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
 datasources: {
 db: {
 url: process.env.DATABASE_URL,
 },
 },
 // Error formatting
 errorFormat: 'minimal',
 });
 
 // Add query performance monitoring in development
 if (process.env.NODE_ENV === 'development' && !globalThis.__prisma) {
 prisma.$use(async (params: any, next: any) => {
 const before = Date.now();
 const result = await next(params);
 const after = Date.now();
 
 if (after - before > 1000) {
 console.warn(`Slow query: ${params.model}.${params.action} took ${after - before}ms`);
 }
 
 return result;
 });
 }
   }
  } catch (error) {
   console.error('Failed to initialize Prisma, falling back to mock:', error);
   prisma = mockPrisma;
  }

  // Redis connection for caching and sessions
  try {
   if (USE_MOCK) {
   console.log('Using mock Redis client');
   redis = mockRedis;
   sessionRedis = mockSessionRedis;
   } else {
   redis = globalThis.__redis ?? new Redis({
 host: process.env.REDIS_HOST || 'localhost',
 port: parseInt(process.env.REDIS_PORT || '6379'),
 password: process.env.REDIS_PASSWORD || undefined,
 db: parseInt(process.env.REDIS_DB || '0'),
 maxRetriesPerRequest: 3,
 retryDelayOnFailover: 100,
 enableReadyCheck: false,
 lazyConnect: true,
 connectTimeout: 60000,
 commandTimeout: 5000,
 });

 // Redis instance for sessions (separate database)
 sessionRedis = new Redis({
 host: process.env.REDIS_HOST || 'localhost',
 port: parseInt(process.env.REDIS_PORT || '6379'),
 password: process.env.REDIS_PASSWORD || undefined,
 db: parseInt(process.env.REDIS_SESSION_DB || '1'),
 maxRetriesPerRequest: 3,
 retryDelayOnFailover: 100,
 enableReadyCheck: false,
 lazyConnect: true,
 });
 }
  } catch (error) {
   console.error('Failed to initialize Redis, falling back to mock:', error);
   redis = mockRedis;
   sessionRedis = mockSessionRedis;
  }

  // Development hot reloading
  if (process.env.NODE_ENV === 'development' && !USE_MOCK) {
   globalThis.__prisma = prisma;
   globalThis.__redis = redis;
  }
} else {
  // Client-side stub - these should never be called
  console.warn('Database client accessed on client side - using stubs');
}

// Connection health checks
export const checkDatabaseHealth = async (): Promise<boolean> => {
 if (typeof window !== 'undefined') return false;
 try {
 const USE_MOCK = process.env.USE_MOCK_DB === 'true' || !process.env.DATABASE_URL;
 if (USE_MOCK) return false;
 await prisma.$queryRaw`SELECT 1`;
 return true;
 } catch (error) {
 console.error('Database health check failed:', error);
 return false;
 }
};

export const checkRedisHealth = async (): Promise<boolean> => {
 if (typeof window !== 'undefined') return false;
 try {
 const USE_MOCK = process.env.USE_MOCK_DB === 'true' || !process.env.DATABASE_URL;
 if (USE_MOCK) return false;
 await redis.ping();
 return true;
 } catch (error) {
 console.error('Redis health check failed:', error);
 return false;
 }
};

// Graceful shutdown - only on server
if (typeof window === 'undefined') {
  const gracefulShutdown = async () => {
   console.log('Shutting down database connections...');
   const USE_MOCK = process.env.USE_MOCK_DB === 'true' || !process.env.DATABASE_URL;
   if (!USE_MOCK) {
   await prisma.$disconnect();
   redis.disconnect();
   sessionRedis.disconnect();
   }
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

export { prisma, redis, sessionRedis };
export default prisma;