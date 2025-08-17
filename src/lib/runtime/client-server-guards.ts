/**
 * Client-Server Boundary Guards
 * Modular utilities to prevent server-only modules from being imported on client side
 */

import React from 'react';

/**
 * Check if we're running in client side environment
 */
export const isClient = typeof window !== 'undefined';

/**
 * Check if we're running in server side environment
 */
export const isServer = !isClient;

/**
 * Check if we're running in Edge Runtime
 */
export const isEdgeRuntime = 
  typeof EdgeRuntime !== 'undefined' || 
  (globalThis as any)?.EdgeRuntime !== undefined ||
  process.env.EDGE_RUNTIME === '1';

/**
 * Check if we're in development mode
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Safe server-only import wrapper
 * Prevents server modules from being imported on client side
 */
export function safeServerImport<T>(
  importFn: () => Promise<T> | T,
  fallback?: T
): T | null {
  if (isClient) {
    console.warn('Attempted to import server-only module on client side');
    return fallback || null;
  }
  
  try {
    const result = importFn();
    return result instanceof Promise ? null : result;
  } catch (error) {
    console.error('Safe server import failed:', error);
    return fallback || null;
  }
}

/**
 * Async safe server-only import wrapper
 */
export async function safeServerImportAsync<T>(
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  if (isClient) {
    console.warn('Attempted to import server-only module on client side');
    return fallback || null;
  }
  
  try {
    return await importFn();
  } catch (error) {
    console.error('Safe async server import failed:', error);
    return fallback || null;
  }
}

/**
 * Edge Runtime compatible import wrapper
 * Prevents Node.js-only modules from being imported in Edge Runtime
 */
export function safeNodeImport<T>(
  importFn: () => T | Promise<T>,
  fallback?: T
): T | null {
  if (isClient || isEdgeRuntime) {
    console.warn('Attempted to import Node.js-only module in non-Node environment');
    return fallback || null;
  }
  
  try {
    const result = importFn();
    return result instanceof Promise ? null : result;
  } catch (error) {
    console.error('Safe Node import failed:', error);
    return fallback || null;
  }
}

/**
 * Async Edge Runtime compatible import wrapper
 */
export async function safeNodeImportAsync<T>(
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  if (isClient || isEdgeRuntime) {
    console.warn('Attempted to import Node.js-only module in non-Node environment');
    return fallback || null;
  }
  
  try {
    return await importFn();
  } catch (error) {
    console.error('Safe async Node import failed:', error);
    return fallback || null;
  }
}

/**
 * Safe database client import
 * Specialized for database clients that shouldn't be imported on client
 */
export function safeDatabaseImport<T>(
  importFn: () => T,
  mockFn?: () => T
): T | null {
  if (isClient) {
    console.warn('Database client accessed on client side');
    return mockFn ? mockFn() : null;
  }
  
  try {
    return importFn();
  } catch (error) {
    console.error('Database import failed:', error);
    return mockFn ? mockFn() : null;
  }
}

/**
 * Create a client-safe component wrapper
 * Prevents server-only components from rendering on client
 */
export function createClientSafeComponent<P extends object>(
  ServerComponent: React.ComponentType<P>,
  ClientFallback?: React.ComponentType<P>,
  loadingComponent?: React.ComponentType
) {
  return function ClientSafeWrapper(props: P) {
    if (isClient) {
      if (ClientFallback) {
        return React.createElement(ClientFallback, props);
      }
      if (loadingComponent) {
        return React.createElement(loadingComponent);
      }
      return null;
    }
    
    return React.createElement(ServerComponent, props);
  };
}

/**
 * Runtime environment detection utilities
 */
export const RuntimeDetection = {
  isClient,
  isServer,
  isEdgeRuntime,
  isDevelopment,
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  
  // Browser detection
  isBrowser: isClient,
  isNode: isServer && !isEdgeRuntime,
  
  // Next.js specific
  isNextJsRuntime: typeof process !== 'undefined' && process.env.__NEXT_PRIVATE_PREBUNDLED_REACT,
  
  // Deployment environment
  isVercel: process.env.VERCEL === '1',
  isNetlify: process.env.NETLIFY === 'true',
  isAWS: process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined,
};

/**
 * Safe feature detection
 */
export const FeatureDetection = {
  hasWindow: typeof window !== 'undefined',
  hasDocument: typeof document !== 'undefined',
  hasNavigator: typeof navigator !== 'undefined',
  hasLocalStorage: isClient && typeof localStorage !== 'undefined',
  hasSessionStorage: isClient && typeof sessionStorage !== 'undefined',
  hasIndexedDB: isClient && typeof indexedDB !== 'undefined',
  hasWebGL: isClient && (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  })(),
  hasServiceWorker: isClient && 'serviceWorker' in navigator,
  hasNotifications: isClient && 'Notification' in window,
  hasGeolocation: isClient && 'geolocation' in navigator,
};

/**
 * Error boundary for module loading errors
 */
export class ModuleLoadingErrorBoundary extends Error {
  constructor(
    public moduleName: string,
    public environment: 'client' | 'server' | 'edge',
    originalError?: Error
  ) {
    super(`Module loading error: ${moduleName} in ${environment} environment`);
    this.name = 'ModuleLoadingError';
    this.cause = originalError;
  }
}

/**
 * Safe module loader with error handling
 */
export async function loadModuleSafely<T>(
  moduleName: string,
  importFn: () => Promise<T>,
  options: {
    fallback?: T;
    retries?: number;
    retryDelay?: number;
    allowClient?: boolean;
    allowEdge?: boolean;
  } = {}
): Promise<T | null> {
  const {
    fallback,
    retries = 3,
    retryDelay = 1000,
    allowClient = false,
    allowEdge = false
  } = options;
  
  // Environment checks
  if (isClient && !allowClient) {
    console.warn(`Module ${moduleName} not allowed on client side`);
    return fallback || null;
  }
  
  if (isEdgeRuntime && !allowEdge) {
    console.warn(`Module ${moduleName} not allowed in Edge Runtime`);
    return fallback || null;
  }
  
  let lastError: Error;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await importFn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Module loading attempt ${attempt + 1}/${retries} failed for ${moduleName}:`, error);
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.error(`Failed to load module ${moduleName} after ${retries} attempts`);
  throw new ModuleLoadingErrorBoundary(
    moduleName,
    isClient ? 'client' : isEdgeRuntime ? 'edge' : 'server',
    lastError!
  );
}

export default {
  safeServerImport,
  safeServerImportAsync,
  safeNodeImport,
  safeNodeImportAsync,
  safeDatabaseImport,
  createClientSafeComponent,
  loadModuleSafely,
  RuntimeDetection,
  FeatureDetection,
  ModuleLoadingErrorBoundary,
};