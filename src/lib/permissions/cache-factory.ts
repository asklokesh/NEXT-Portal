/**
 * Cache Factory
 * Determines which cache implementation to use based on runtime environment
 */

// Check if we're in Edge Runtime
const isEdgeRuntime = typeof globalThis.EdgeRuntime !== 'undefined' ||
  (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge');

/**
 * Get appropriate cache implementation
 * Returns Edge-compatible cache for middleware, full cache for server
 */
export async function getCacheImplementation() {
  if (isEdgeRuntime) {
    // Use Edge-compatible cache in middleware
    const { PermissionCache } = await import('./permission-cache-edge');
    return PermissionCache;
  } else {
    // Use full Redis-backed cache in server environment
    const { PermissionCache } = await import('./permission-cache');
    return PermissionCache;
  }
}

/**
 * Get appropriate permission engine
 */
export async function getPermissionEngineImplementation() {
  if (isEdgeRuntime) {
    // Use Edge-compatible engine in middleware
    const { PermissionEngineEdge } = await import('./permission-engine-edge');
    return PermissionEngineEdge.getInstance();
  } else {
    // Use full engine in server environment
    const { getPermissionEngine } = await import('./index');
    try {
      return getPermissionEngine();
    } catch (error) {
      // Initialize if not already done
      const { initializePermissions } = await import('./index');
      await initializePermissions();
      return getPermissionEngine();
    }
  }
}

/**
 * Get appropriate helpers
 */
export async function getPermissionHelpers() {
  if (isEdgeRuntime) {
    // Use Edge-compatible helpers in middleware
    return import('./helpers-edge');
  } else {
    // Use full helpers in server environment
    return import('./helpers');
  }
}