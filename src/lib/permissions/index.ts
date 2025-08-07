/**
 * RBAC Permission Framework
 * Main entry point for permission system
 */

import { PermissionEngine } from './permission-engine';
import { RoleManager } from './role-manager';
import { PolicyEngine } from './policy-engine';
import { AuditLogger } from './audit-logger';
import { PermissionCache } from './permission-cache';

// Singleton instances
let permissionEngine: PermissionEngine | null = null;
let roleManager: RoleManager | null = null;
let policyEngine: PolicyEngine | null = null;
let auditLogger: AuditLogger | null = null;

/**
 * Initialize permission system
 */
export async function initializePermissions(): Promise<void> {
  if (!permissionEngine) {
    permissionEngine = new PermissionEngine();
    roleManager = new RoleManager();
    policyEngine = new PolicyEngine();
    auditLogger = new AuditLogger();

    // Load policies from database
    await policyEngine.loadPolicies();
  }
}

/**
 * Get permission engine instance
 */
export function getPermissionEngine(): PermissionEngine {
  if (!permissionEngine) {
    throw new Error('Permission system not initialized');
  }
  return permissionEngine;
}

/**
 * Get role manager instance
 */
export function getRoleManager(): RoleManager {
  if (!roleManager) {
    throw new Error('Permission system not initialized');
  }
  return roleManager;
}

/**
 * Get policy engine instance
 */
export function getPolicyEngine(): PolicyEngine {
  if (!policyEngine) {
    throw new Error('Permission system not initialized');
  }
  return policyEngine;
}

/**
 * Get audit logger instance
 */
export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    throw new Error('Permission system not initialized');
  }
  return auditLogger;
}

// Export all types
export * from './types';

// Export main classes
export { PermissionEngine } from './permission-engine';
export { RoleManager } from './role-manager';
export { PolicyEngine } from './policy-engine';
export { AuditLogger } from './audit-logger';
export { PermissionCache } from './permission-cache';

// Export helper functions
export { checkPermission } from './helpers';
export { withPermission } from './decorators';