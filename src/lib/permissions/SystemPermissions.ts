/**
 * System-Level Permission Checking
 * Handles high-level administrative permissions for system operations
 */

import { NextRequest } from 'next/server';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { validateInput } from '@/lib/security/input-validation';

export interface SystemPermission {
  permission: string;
  description: string;
  level: 'SYSTEM' | 'ADMIN' | 'TENANT';
  category: string;
}

/**
 * System permission definitions
 */
export const SYSTEM_PERMISSIONS: SystemPermission[] = [
  // Super admin permissions
  { permission: 'super-admin:all', description: 'Complete system access', level: 'SYSTEM', category: 'SUPER_ADMIN' },
  
  // System-level tenant management
  { permission: 'system:tenant:create', description: 'Create new tenants', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  { permission: 'system:tenant:read', description: 'Read tenant information', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  { permission: 'system:tenant:suspend', description: 'Suspend tenants', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  { permission: 'system:tenant:reactivate', description: 'Reactivate tenants', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  { permission: 'system:tenant:upgrade', description: 'Upgrade tenant tiers', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  { permission: 'system:tenant:downgrade', description: 'Downgrade tenant tiers', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  { permission: 'system:tenant:archive', description: 'Archive tenants', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  { permission: 'system:tenant:delete', description: 'Delete tenants permanently', level: 'SYSTEM', category: 'TENANT_MANAGEMENT' },
  
  // System administration
  { permission: 'system:config:read', description: 'Read system configuration', level: 'SYSTEM', category: 'SYSTEM_CONFIG' },
  { permission: 'system:config:write', description: 'Modify system configuration', level: 'SYSTEM', category: 'SYSTEM_CONFIG' },
  { permission: 'system:metrics:read', description: 'Access system metrics', level: 'SYSTEM', category: 'MONITORING' },
  { permission: 'system:logs:read', description: 'Access system logs', level: 'SYSTEM', category: 'MONITORING' },
  { permission: 'system:audit:read', description: 'Access audit logs', level: 'SYSTEM', category: 'AUDITING' },
  
  // Platform management
  { permission: 'platform:plugin:manage', description: 'Manage platform-wide plugins', level: 'SYSTEM', category: 'PLUGIN_MANAGEMENT' },
  { permission: 'platform:security:manage', description: 'Manage security settings', level: 'SYSTEM', category: 'SECURITY' },
  { permission: 'platform:backup:manage', description: 'Manage system backups', level: 'SYSTEM', category: 'BACKUP' },
  
  // General admin permissions
  { permission: 'admin:all', description: 'Administrative access to most features', level: 'ADMIN', category: 'GENERAL_ADMIN' },
  { permission: 'admin:users:manage', description: 'Manage users across tenants', level: 'ADMIN', category: 'USER_MANAGEMENT' },
  { permission: 'admin:billing:read', description: 'Read billing information', level: 'ADMIN', category: 'BILLING' },
  { permission: 'admin:billing:write', description: 'Modify billing information', level: 'ADMIN', category: 'BILLING' },
  { permission: 'admin:support:access', description: 'Access support features', level: 'ADMIN', category: 'SUPPORT' }
];

/**
 * Check if user has required system permissions
 */
export async function checkSystemPermissions(
  request: NextRequest,
  requiredPermissions: string[]
): Promise<boolean> {
  try {
    const tenantContext = getTenantContext(request);
    
    // No context means no permissions
    if (!tenantContext || !tenantContext.user) {
      return false;
    }

    const userPermissions = tenantContext.permissions || [];
    
    // Check for super admin access
    if (userPermissions.includes('super-admin:all')) {
      return true;
    }

    // Check for wildcard admin access
    if (requiredPermissions.some(p => p.startsWith('admin:')) && userPermissions.includes('admin:all')) {
      return true;
    }

    // Check specific permissions
    return requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

  } catch (error) {
    console.error('Error checking system permissions:', error);
    return false;
  }
}

/**
 * Check system API key authentication
 */
export function checkSystemApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-system-key') || 
                 request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return false;
  }

  // Validate against system API key
  const systemApiKey = process.env.SYSTEM_API_KEY;
  if (!systemApiKey) {
    console.warn('SYSTEM_API_KEY not configured');
    return false;
  }

  return apiKey === systemApiKey;
}

/**
 * Validate user has tenant ownership or admin rights
 */
export function checkTenantAdminRights(tenantContext: any, targetTenantId: string): boolean {
  if (!tenantContext || !tenantContext.user) {
    return false;
  }

  // Super admin has access to all tenants
  if (tenantContext.permissions.includes('super-admin:all') || 
      tenantContext.permissions.includes('admin:all')) {
    return true;
  }

  // User must be in the same tenant
  if (tenantContext.tenant.id !== targetTenantId) {
    return false;
  }

  // User must have admin role in tenant
  return tenantContext.user.role === 'OWNER' || 
         tenantContext.user.role === 'ADMIN' ||
         tenantContext.permissions.includes('tenant:admin');
}

/**
 * Get user's effective permissions (including inherited ones)
 */
export function getEffectivePermissions(tenantContext: any): string[] {
  if (!tenantContext || !tenantContext.user) {
    return [];
  }

  let permissions = [...(tenantContext.permissions || [])];

  // Add role-based permissions
  const userRole = tenantContext.user.role;
  
  switch (userRole) {
    case 'OWNER':
      permissions.push(
        'tenant:admin',
        'tenant:billing',
        'tenant:users:manage',
        'tenant:plugins:manage',
        'tenant:config:write'
      );
      break;
      
    case 'ADMIN':
      permissions.push(
        'tenant:users:manage',
        'tenant:plugins:manage',
        'tenant:config:read'
      );
      break;
      
    case 'MEMBER':
      permissions.push(
        'tenant:read',
        'plugin:use'
      );
      break;
      
    case 'VIEWER':
      permissions.push(
        'tenant:read'
      );
      break;
  }

  // Remove duplicates
  return [...new Set(permissions)];
}

/**
 * Permission validation middleware
 */
export function createPermissionValidator(requiredPermissions: string[]) {
  return async (request: NextRequest): Promise<{
    hasPermission: boolean;
    error?: string;
    missingPermissions?: string[];
  }> => {
    try {
      // Check system API key first
      if (checkSystemApiKey(request)) {
        return { hasPermission: true };
      }

      // Check user permissions
      const hasPermission = await checkSystemPermissions(request, requiredPermissions);
      
      if (!hasPermission) {
        const tenantContext = getTenantContext(request);
        const userPermissions = tenantContext?.permissions || [];
        const missingPermissions = requiredPermissions.filter(
          perm => !userPermissions.includes(perm)
        );

        return {
          hasPermission: false,
          error: 'Insufficient permissions',
          missingPermissions
        };
      }

      return { hasPermission: true };

    } catch (error) {
      console.error('Permission validation error:', error);
      return {
        hasPermission: false,
        error: 'Permission validation failed'
      };
    }
  };
}

/**
 * Rate limiting for system operations
 */
export class SystemOperationRateLimit {
  private operationCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxOperations = 10; // Max operations per window

  checkRateLimit(userId: string, operation: string): boolean {
    const key = `${userId}:${operation}`;
    const now = Date.now();
    const record = this.operationCounts.get(key);

    if (!record || now > record.resetTime) {
      this.operationCounts.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (record.count >= this.maxOperations) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingOperations(userId: string, operation: string): number {
    const key = `${userId}:${operation}`;
    const record = this.operationCounts.get(key);
    
    if (!record || Date.now() > record.resetTime) {
      return this.maxOperations;
    }

    return Math.max(0, this.maxOperations - record.count);
  }
}

export const systemRateLimit = new SystemOperationRateLimit();

/**
 * Permission checking utilities
 */
export const PermissionUtils = {
  /**
   * Check if permission exists in system
   */
  isValidPermission(permission: string): boolean {
    return SYSTEM_PERMISSIONS.some(p => p.permission === permission);
  },

  /**
   * Get permission by name
   */
  getPermission(permission: string): SystemPermission | undefined {
    return SYSTEM_PERMISSIONS.find(p => p.permission === permission);
  },

  /**
   * Get permissions by category
   */
  getPermissionsByCategory(category: string): SystemPermission[] {
    return SYSTEM_PERMISSIONS.filter(p => p.category === category);
  },

  /**
   * Check if permission is system-level
   */
  isSystemPermission(permission: string): boolean {
    const perm = this.getPermission(permission);
    return perm?.level === 'SYSTEM' || false;
  },

  /**
   * Validate permission hierarchy
   */
  canGrantPermission(grantorPermissions: string[], targetPermission: string): boolean {
    // Super admins can grant any permission
    if (grantorPermissions.includes('super-admin:all')) {
      return true;
    }

    // System permissions can only be granted by super admins
    if (this.isSystemPermission(targetPermission)) {
      return false;
    }

    // Admin permissions can be granted by admins
    if (targetPermission.startsWith('admin:')) {
      return grantorPermissions.includes('admin:all') || 
             grantorPermissions.includes('super-admin:all');
    }

    // Tenant permissions can be granted by tenant admins
    if (targetPermission.startsWith('tenant:')) {
      return grantorPermissions.includes('tenant:admin') ||
             grantorPermissions.includes('admin:all') ||
             grantorPermissions.includes('super-admin:all');
    }

    return false;
  }
};

export default {
  checkSystemPermissions,
  checkSystemApiKey,
  checkTenantAdminRights,
  getEffectivePermissions,
  createPermissionValidator,
  systemRateLimit,
  PermissionUtils,
  SYSTEM_PERMISSIONS
};