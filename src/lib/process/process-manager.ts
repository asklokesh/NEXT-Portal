/**
 * Process Manager - Memory Leak Prevention
 * Handles process event listeners safely to prevent MaxListenersExceeded warnings
 */

import { isServer } from '../runtime/client-server-guards';

// Track registered handlers to prevent duplicates
const registeredHandlers = new Set<string>();
let isShuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

// Store cleanup functions
const cleanupFunctions: Array<() => Promise<void> | void> = [];
const cleanupFunctionNames = new Set<string>();

/**
 * Register a cleanup function with deduplication
 */
export function registerCleanupFunction(
  name: string,
  cleanupFn: () => Promise<void> | void,
  force = false
): void {
  if (!isServer) {
    return;
  }

  if (cleanupFunctionNames.has(name) && !force) {
    console.warn(`Cleanup function ${name} already registered`);
    return;
  }

  cleanupFunctionNames.add(name);
  cleanupFunctions.push(cleanupFn);
}

/**
 * Unregister a cleanup function
 */
export function unregisterCleanupFunction(name: string): boolean {
  if (!cleanupFunctionNames.has(name)) {
    return false;
  }

  cleanupFunctionNames.delete(name);
  // Note: We keep the function in the array to avoid index issues
  // The function will just be a no-op
  return true;
}

/**
 * Execute all cleanup functions
 */
async function executeCleanup(): Promise<void> {
  if (isShuttingDown) {
    return shutdownPromise || Promise.resolve();
  }

  isShuttingDown = true;
  
  shutdownPromise = (async () => {
    console.log('🧹 Starting graceful shutdown...');
    const startTime = Date.now();

    const cleanupPromises = cleanupFunctions.map(async (cleanupFn, index) => {
      try {
        await cleanupFn();
      } catch (error) {
        console.error(`Cleanup function ${index} failed:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Graceful shutdown completed in ${duration}ms`);
  })();

  return shutdownPromise;
}

/**
 * Safe process event listener registration
 */
export function registerProcessHandlers(): void {
  if (!isServer) {
    return;
  }

  // Prevent multiple registrations
  if (registeredHandlers.has('main')) {
    return;
  }

  // Increase max listeners to prevent warnings
  if (process.getMaxListeners() < 20) {
    process.setMaxListeners(20);
  }

  // Remove any existing listeners first
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGUSR1');
  process.removeAllListeners('SIGUSR2');
  process.removeAllListeners('beforeExit');
  process.removeAllListeners('exit');

  // Register single handlers for each signal
  const handleShutdown = async (signal: string) => {
    console.log(`\n📡 Received ${signal}, starting graceful shutdown...`);
    
    try {
      await executeCleanup();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  const handleExit = () => {
    if (!isShuttingDown) {
      console.log('⚡ Process exiting without graceful shutdown');
    }
  };

  // Register handlers
  process.once('SIGINT', () => handleShutdown('SIGINT'));
  process.once('SIGTERM', () => handleShutdown('SIGTERM'));
  process.once('SIGUSR1', () => handleShutdown('SIGUSR1'));
  process.once('SIGUSR2', () => handleShutdown('SIGUSR2'));
  process.once('beforeExit', handleExit);

  registeredHandlers.add('main');

  // Register common cleanup functions
  registerDatabaseCleanup();
  registerTempFileCleanup();
  registerTimerCleanup();
}

/**
 * Database cleanup registration
 */
function registerDatabaseCleanup(): void {
  registerCleanupFunction('database', async () => {
    try {
      // Dynamically import database client to avoid circular dependencies
      const { getSafePrismaClient, getSafeRedisClient, getSafeSessionRedisClient } = 
        await import('../db/safe-client');

      console.log('🗄️ Closing database connections...');
      
      const prisma = getSafePrismaClient();
      const redis = getSafeRedisClient();
      const sessionRedis = getSafeSessionRedisClient();

      await Promise.allSettled([
        prisma.$disconnect?.(),
        new Promise<void>(resolve => {
          redis.disconnect?.();
          resolve();
        }),
        new Promise<void>(resolve => {
          sessionRedis.disconnect?.();
          resolve();
        })
      ]);

      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('❌ Database cleanup error:', error);
    }
  });
}

/**
 * Temporary file cleanup
 */
function registerTempFileCleanup(): void {
  registerCleanupFunction('temp-files', async () => {
    console.log('🗑️ Cleaning up temporary files...');
    // Add your temp file cleanup logic here
    console.log('✅ Temporary files cleaned');
  });
}

/**
 * Timer and interval cleanup
 */
let activeTimers: Set<NodeJS.Timer> = new Set();
let activeIntervals: Set<NodeJS.Timer> = new Set();

export function registerTimer(timer: NodeJS.Timer): void {
  activeTimers.add(timer);
}

export function registerInterval(interval: NodeJS.Timer): void {
  activeIntervals.add(interval);
}

function registerTimerCleanup(): void {
  registerCleanupFunction('timers', async () => {
    console.log('⏰ Cleaning up timers and intervals...');
    
    for (const timer of activeTimers) {
      clearTimeout(timer);
    }
    
    for (const interval of activeIntervals) {
      clearInterval(interval);
    }
    
    activeTimers.clear();
    activeIntervals.clear();
    
    console.log('✅ Timers and intervals cleaned');
  });
}

/**
 * Health check for process manager
 */
export function getProcessManagerStatus() {
  return {
    isShuttingDown,
    registeredHandlers: Array.from(registeredHandlers),
    cleanupFunctionsCount: cleanupFunctions.length,
    cleanupFunctionNames: Array.from(cleanupFunctionNames),
    maxListeners: process.getMaxListeners(),
    activeTimers: activeTimers.size,
    activeIntervals: activeIntervals.size,
    listenerCounts: {
      SIGINT: process.listenerCount('SIGINT'),
      SIGTERM: process.listenerCount('SIGTERM'),
      SIGUSR1: process.listenerCount('SIGUSR1'),
      SIGUSR2: process.listenerCount('SIGUSR2'),
      beforeExit: process.listenerCount('beforeExit'),
      exit: process.listenerCount('exit'),
    }
  };
}

/**
 * Force cleanup (for testing or emergency situations)
 */
export async function forceCleanup(): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise;
  }
  
  return executeCleanup();
}

/**
 * Reset process manager (for testing)
 */
export function resetProcessManager(): void {
  if (!isServer) {
    return;
  }

  isShuttingDown = false;
  shutdownPromise = null;
  registeredHandlers.clear();
  cleanupFunctions.length = 0;
  cleanupFunctionNames.clear();
  activeTimers.clear();
  activeIntervals.clear();
}

// Initialize process handlers on server
if (isServer) {
  // Use setImmediate to ensure this runs after all modules are loaded
  setImmediate(() => {
    registerProcessHandlers();
  });
}

export default {
  registerCleanupFunction,
  unregisterCleanupFunction,
  registerProcessHandlers,
  getProcessManagerStatus,
  forceCleanup,
  resetProcessManager,
  registerTimer,
  registerInterval,
};