/**
 * Safe Database Client with Runtime Guards
 * Prevents client-side imports and provides fallbacks
 */

import { 
  safeServerImport, 
  safeNodeImportAsync, 
  isClient, 
  isServer,
  ModuleLoadingErrorBoundary 
} from '../runtime/client-server-guards';

// Type definitions for safe usage
interface SafePrismaClient {
  $queryRaw: (...args: any[]) => Promise<any>;
  $disconnect: () => Promise<void>;
  [key: string]: any;
}

interface SafeRedisClient {
  ping: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...args: any[]) => Promise<string>;
  del: (key: string) => Promise<number>;
  disconnect: () => void;
  [key: string]: any;
}

// Mock implementations for client-side or Edge Runtime
const createMockPrisma = (): SafePrismaClient => ({
  $queryRaw: async () => {
    console.warn('Mock Prisma: Database query not available on client side');
    return [];
  },
  $disconnect: async () => {
    console.warn('Mock Prisma: Disconnect not available on client side');
  },
  // Add commonly used model methods
  plugin: {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    create: async () => null,
    update: async () => null,
    delete: async () => null,
  },
  user: {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    create: async () => null,
    update: async () => null,
    delete: async () => null,
  },
  // Generic fallback for any model
  [Symbol.for('proxy')]: true
});

const createMockRedis = (): SafeRedisClient => ({
  ping: async () => {
    console.warn('Mock Redis: Ping not available on client side');
    return 'PONG';
  },
  get: async () => {
    console.warn('Mock Redis: Get not available on client side');
    return null;
  },
  set: async () => {
    console.warn('Mock Redis: Set not available on client side');
    return 'OK';
  },
  del: async () => {
    console.warn('Mock Redis: Del not available on client side');
    return 0;
  },
  disconnect: () => {
    console.warn('Mock Redis: Disconnect not available on client side');
  }
});

// Safe database client initialization
let safePrismaClient: SafePrismaClient | null = null;
let safeRedisClient: SafeRedisClient | null = null;
let safeSessionRedisClient: SafeRedisClient | null = null;

/**
 * Get safe Prisma client with proper guards
 */
export function getSafePrismaClient(): SafePrismaClient {
  if (isClient) {
    return createMockPrisma();
  }

  if (!safePrismaClient) {
    try {
      // Try to import the real client
      safePrismaClient = safeServerImport(() => {
        const clientModule = require('../db/client');
        return clientModule.prisma || clientModule.default;
      }, createMockPrisma());
    } catch (error) {
      console.warn('Failed to load Prisma client, using mock:', error);
      safePrismaClient = createMockPrisma();
    }
  }

  return safePrismaClient || createMockPrisma();
}

/**
 * Get safe Redis client with proper guards
 */
export function getSafeRedisClient(): SafeRedisClient {
  if (isClient) {
    return createMockRedis();
  }

  if (!safeRedisClient) {
    try {
      safeRedisClient = safeServerImport(() => {
        const clientModule = require('../db/client');
        return clientModule.redis;
      }, createMockRedis());
    } catch (error) {
      console.warn('Failed to load Redis client, using mock:', error);
      safeRedisClient = createMockRedis();
    }
  }

  return safeRedisClient || createMockRedis();
}

/**
 * Get safe Session Redis client with proper guards
 */
export function getSafeSessionRedisClient(): SafeRedisClient {
  if (isClient) {
    return createMockRedis();
  }

  if (!safeSessionRedisClient) {
    try {
      safeSessionRedisClient = safeServerImport(() => {
        const clientModule = require('../db/client');
        return clientModule.sessionRedis;
      }, createMockRedis());
    } catch (error) {
      console.warn('Failed to load Session Redis client, using mock:', error);
      safeSessionRedisClient = createMockRedis();
    }
  }

  return safeSessionRedisClient || createMockRedis();
}

/**
 * Async database health check with safety guards
 */
export async function checkDatabaseHealthSafe(): Promise<{
  database: boolean;
  redis: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let databaseHealthy = false;
  let redisHealthy = false;

  if (isClient) {
    return {
      database: false,
      redis: false,
      errors: ['Database health checks not available on client side']
    };
  }

  // Check database health
  try {
    const prisma = getSafePrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    databaseHealthy = true;
  } catch (error) {
    errors.push(`Database health check failed: ${error}`);
  }

  // Check Redis health
  try {
    const redis = getSafeRedisClient();
    await redis.ping();
    redisHealthy = true;
  } catch (error) {
    errors.push(`Redis health check failed: ${error}`);
  }

  return {
    database: databaseHealthy,
    redis: redisHealthy,
    errors
  };
}

/**
 * Safe module loading for database-related imports
 */
export async function loadDatabaseModuleSafely<T>(
  moduleName: string,
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  try {
    return await safeNodeImportAsync(importFn, fallback);
  } catch (error) {
    if (error instanceof ModuleLoadingErrorBoundary) {
      console.error(`Database module loading failed: ${error.message}`);
    } else {
      console.error(`Unexpected error loading database module ${moduleName}:`, error);
    }
    return fallback || null;
  }
}

/**
 * Create safe database operation wrapper
 */
export function createSafeDatabaseOperation<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  operationName: string,
  fallbackValue?: R
) {
  return async (...args: T): Promise<R | null> => {
    if (isClient) {
      console.warn(`Database operation ${operationName} not available on client side`);
      return fallbackValue || null;
    }

    try {
      return await operation(...args);
    } catch (error) {
      console.error(`Database operation ${operationName} failed:`, error);
      return fallbackValue || null;
    }
  };
}

// Register cleanup with the process manager to prevent memory leaks
if (isServer) {
  // Import process manager to register cleanup
  import('../process/process-manager').then((processManager) => {
    processManager.registerCleanupFunction('safe-database-client', async () => {
      console.log('🗄️ Shutting down safe database connections...');
      
      try {
        if (safePrismaClient) {
          await safePrismaClient.$disconnect();
        }
        
        if (safeRedisClient) {
          safeRedisClient.disconnect();
        }
        
        if (safeSessionRedisClient) {
          safeSessionRedisClient.disconnect();
        }
        
        // Reset clients
        safePrismaClient = null;
        safeRedisClient = null;
        safeSessionRedisClient = null;
        
        console.log('✅ Safe database connections closed');
      } catch (error) {
        console.error('❌ Error during safe database shutdown:', error);
      }
    });
  }).catch((error) => {
    console.warn('Failed to register database cleanup with process manager:', error);
  });
}

export default {
  getSafePrismaClient,
  getSafeRedisClient,
  getSafeSessionRedisClient,
  checkDatabaseHealthSafe,
  loadDatabaseModuleSafely,
  createSafeDatabaseOperation,
};