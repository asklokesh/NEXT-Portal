import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';

const prisma = new PrismaClient();

export interface QualityGatePermissions {
  canViewQualityScores: boolean;
  canRunEvaluations: boolean;
  canResolveIssues: boolean;
  canManageConfiguration: boolean;
  canViewSensitiveData: boolean;
  canManageGovernance: boolean;
  canAccessTenantData: boolean;
}

export interface QualityGateUser {
  id: string;
  role: string;
  tenantId?: string;
  permissions: QualityGatePermissions;
}

/**
 * Multi-tenant access control and permissions for quality gate system
 */
export class QualityGateAuthService {
  
  /**
   * Get user permissions for quality gate operations
   */
  static async getUserPermissions(userId: string, tenantId?: string): Promise<QualityGateUser | null> {
    try {
      // Get user information from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  permissions: true
                }
              }
            }
          }
        }
      });

      if (!user) {
        return null;
      }

      // Calculate permissions based on role and team memberships
      const permissions = this.calculatePermissions(user, tenantId);

      return {
        id: user.id,
        role: user.role,
        tenantId,
        permissions
      };

    } catch (error) {
      console.error('Error getting user permissions:', error);
      return null;
    }
  }

  /**
   * Check if user can access plugin quality data
   */
  static async canAccessPluginQuality(
    userId: string, 
    pluginId: string, 
    tenantId?: string
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId, tenantId);
      if (!userPermissions) return false;

      // Admin and platform engineers can access all quality data
      if (['ADMIN', 'PLATFORM_ENGINEER'].includes(userPermissions.role)) {
        return true;
      }

      // Get plugin information
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
        select: {
          tenantId: true,
          status: true
        }
      });

      if (!plugin) return false;

      // Multi-tenant access control
      if (tenantId && plugin.tenantId && plugin.tenantId !== tenantId) {
        return false;
      }

      // Users can view quality data for plugins in their tenant
      return userPermissions.permissions.canViewQualityScores;

    } catch (error) {
      console.error('Error checking plugin access:', error);
      return false;
    }
  }

  /**
   * Check if user can perform quality evaluations
   */
  static async canRunEvaluation(
    userId: string, 
    pluginId: string, 
    tenantId?: string
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId, tenantId);
      if (!userPermissions) return false;

      const canAccess = await this.canAccessPluginQuality(userId, pluginId, tenantId);
      if (!canAccess) return false;

      return userPermissions.permissions.canRunEvaluations;

    } catch (error) {
      console.error('Error checking evaluation permissions:', error);
      return false;
    }
  }

  /**
   * Check if user can resolve quality issues
   */
  static async canResolveIssue(
    userId: string, 
    issueId: string, 
    tenantId?: string
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId, tenantId);
      if (!userPermissions) return false;

      // Get issue information
      const issue = await prisma.pluginQualityIssue.findUnique({
        where: { id: issueId },
        select: {
          pluginId: true,
          tenantId: true,
          assignedTo: true,
          severity: true
        }
      });

      if (!issue) return false;

      // Multi-tenant access control
      if (tenantId && issue.tenantId && issue.tenantId !== tenantId) {
        return false;
      }

      // Check plugin access
      const canAccessPlugin = await this.canAccessPluginQuality(
        userId, 
        issue.pluginId, 
        tenantId
      );
      if (!canAccessPlugin) return false;

      // Admin and platform engineers can resolve any issue
      if (['ADMIN', 'PLATFORM_ENGINEER'].includes(userPermissions.role)) {
        return true;
      }

      // Users can resolve issues assigned to them
      if (issue.assignedTo === userId) {
        return true;
      }

      // Check general resolution permissions
      return userPermissions.permissions.canResolveIssues;

    } catch (error) {
      console.error('Error checking issue resolution permissions:', error);
      return false;
    }
  }

  /**
   * Check if user can manage quality gate configuration
   */
  static async canManageConfiguration(
    userId: string, 
    configId?: string, 
    tenantId?: string
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId, tenantId);
      if (!userPermissions) return false;

      // Only admin and platform engineers can manage configuration
      if (!['ADMIN', 'PLATFORM_ENGINEER'].includes(userPermissions.role)) {
        return false;
      }

      if (configId) {
        const config = await prisma.qualityGateConfig.findUnique({
          where: { id: configId },
          select: { tenantId: true }
        });

        if (!config) return false;

        // Multi-tenant access control
        if (tenantId && config.tenantId && config.tenantId !== tenantId) {
          return false;
        }
      }

      return userPermissions.permissions.canManageConfiguration;

    } catch (error) {
      console.error('Error checking configuration permissions:', error);
      return false;
    }
  }

  /**
   * Filter plugins by tenant access
   */
  static async filterPluginsByTenantAccess(
    pluginIds: string[], 
    userId: string, 
    tenantId?: string
  ): Promise<string[]> {
    try {
      const userPermissions = await this.getUserPermissions(userId, tenantId);
      if (!userPermissions) return [];

      // Admin can access all plugins
      if (userPermissions.role === 'ADMIN') {
        return pluginIds;
      }

      // Get plugins with tenant filtering
      const accessiblePlugins = await prisma.plugin.findMany({
        where: {
          id: { in: pluginIds },
          OR: [
            { tenantId: null }, // Public plugins
            { tenantId: tenantId }, // Tenant-specific plugins
          ]
        },
        select: { id: true }
      });

      return accessiblePlugins.map(p => p.id);

    } catch (error) {
      console.error('Error filtering plugins by tenant access:', error);
      return [];
    }
  }

  /**
   * Get audit context for quality gate operations
   */
  static getAuditContext(): {
    userId?: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
  } {
    try {
      const headersList = headers();
      
      return {
        userId: headersList.get('x-user-id') || undefined,
        tenantId: headersList.get('x-tenant-id') || undefined,
        ipAddress: headersList.get('x-forwarded-for') || 
                  headersList.get('x-real-ip') || 
                  undefined,
        userAgent: headersList.get('user-agent') || undefined
      };
    } catch (error) {
      // Headers might not be available in all contexts
      return {};
    }
  }

  /**
   * Log quality gate audit event
   */
  static async logAuditEvent(
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const context = this.getAuditContext();
      
      if (context.userId) {
        await prisma.auditLog.create({
          data: {
            userId: context.userId,
            action,
            resource,
            resourceId,
            metadata: {
              ...metadata,
              tenantId: context.tenantId,
              source: 'quality-gate'
            },
            ipAddress: context.ipAddress,
            userAgent: context.userAgent
          }
        });
      }
    } catch (error) {
      console.error('Error logging audit event:', error);
      // Don't throw - audit logging failures shouldn't break operations
    }
  }

  // Private helper methods

  private static calculatePermissions(user: any, tenantId?: string): QualityGatePermissions {
    const role = user.role;
    
    // Base permissions by role
    const rolePermissions: Record<string, Partial<QualityGatePermissions>> = {
      'ADMIN': {
        canViewQualityScores: true,
        canRunEvaluations: true,
        canResolveIssues: true,
        canManageConfiguration: true,
        canViewSensitiveData: true,
        canManageGovernance: true,
        canAccessTenantData: true
      },
      'PLATFORM_ENGINEER': {
        canViewQualityScores: true,
        canRunEvaluations: true,
        canResolveIssues: true,
        canManageConfiguration: true,
        canViewSensitiveData: true,
        canManageGovernance: false,
        canAccessTenantData: true
      },
      'DEVELOPER': {
        canViewQualityScores: true,
        canRunEvaluations: true,
        canResolveIssues: false,
        canManageConfiguration: false,
        canViewSensitiveData: false,
        canManageGovernance: false,
        canAccessTenantData: false
      },
      'VIEWER': {
        canViewQualityScores: true,
        canRunEvaluations: false,
        canResolveIssues: false,
        canManageConfiguration: false,
        canViewSensitiveData: false,
        canManageGovernance: false,
        canAccessTenantData: false
      }
    };

    const basePermissions = rolePermissions[role] || rolePermissions['VIEWER'];

    // TODO: Enhanced permissions based on team memberships
    // This could be extended to check team-specific permissions
    // from the team permissions table

    return {
      canViewQualityScores: false,
      canRunEvaluations: false,
      canResolveIssues: false,
      canManageConfiguration: false,
      canViewSensitiveData: false,
      canManageGovernance: false,
      canAccessTenantData: false,
      ...basePermissions
    };
  }
}

/**
 * Middleware-style permission checker for quality gate routes
 */
export async function checkQualityGatePermission(
  requiredPermission: keyof QualityGatePermissions,
  context: {
    userId?: string;
    tenantId?: string;
    pluginId?: string;
    issueId?: string;
    configId?: string;
  }
): Promise<{
  allowed: boolean;
  user?: QualityGateUser;
  message?: string;
}> {
  try {
    const { userId, tenantId, pluginId, issueId, configId } = context;

    if (!userId) {
      return {
        allowed: false,
        message: 'Authentication required'
      };
    }

    const user = await QualityGateAuthService.getUserPermissions(userId, tenantId);
    if (!user) {
      return {
        allowed: false,
        message: 'User not found or access denied'
      };
    }

    // Check specific permission
    if (!user.permissions[requiredPermission]) {
      return {
        allowed: false,
        user,
        message: `Insufficient permissions: ${requiredPermission} required`
      };
    }

    // Additional context-specific checks
    if (pluginId && !await QualityGateAuthService.canAccessPluginQuality(userId, pluginId, tenantId)) {
      return {
        allowed: false,
        user,
        message: 'Access denied to plugin quality data'
      };
    }

    if (issueId && !await QualityGateAuthService.canResolveIssue(userId, issueId, tenantId)) {
      return {
        allowed: false,
        user,
        message: 'Access denied to resolve this quality issue'
      };
    }

    if (configId && !await QualityGateAuthService.canManageConfiguration(userId, configId, tenantId)) {
      return {
        allowed: false,
        user,
        message: 'Access denied to manage quality configuration'
      };
    }

    return {
      allowed: true,
      user
    };

  } catch (error) {
    console.error('Error checking quality gate permission:', error);
    return {
      allowed: false,
      message: 'Permission check failed'
    };
  }
}

export default QualityGateAuthService;