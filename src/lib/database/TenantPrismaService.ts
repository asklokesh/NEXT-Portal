/**
 * Tenant-Aware Prisma Service
 * High-level service layer for tenant-aware database operations
 */

import { PrismaClient } from '@prisma/client';
import { TenantAwareDatabase, DatabaseContext, createDatabaseContext } from './TenantAwareDatabase';
import { getTenantContext, TenantContext } from '@/lib/tenancy/TenantContext';
import { tenantManager, Tenant } from '@/lib/tenancy/TenantManager';
import { NextRequest } from 'next/server';

export interface TenantOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  tenantId: string;
  timestamp: Date;
}

export interface TenantQueryOptions {
  includeCounts?: boolean;
  includeMetadata?: boolean;
  maxResults?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * High-level tenant-aware database service
 */
export class TenantPrismaService {
  private tenantDb: TenantAwareDatabase;
  private tenantContext: TenantContext | null = null;

  constructor(prisma?: PrismaClient) {
    this.tenantDb = new TenantAwareDatabase(prisma);
  }

  /**
   * Initialize service with tenant context from request
   */
  async initializeFromRequest(request: NextRequest): Promise<boolean> {
    try {
      await this.tenantDb.setContextFromRequest(request);
      this.tenantContext = getTenantContext(request);
      return true;
    } catch (error) {
      console.error('Failed to initialize tenant context:', error);
      return false;
    }
  }

  /**
   * Initialize service with tenant context
   */
  initializeWithContext(tenantContext: TenantContext): void {
    this.tenantContext = tenantContext;
    const dbContext = createDatabaseContext(tenantContext);
    this.tenantDb.setTenantContext(dbContext);
  }

  /**
   * Initialize as system service (bypasses tenant restrictions)
   */
  initializeAsSystem(): void {
    this.tenantDb.createSystemContext();
  }

  /**
   * Plugin Management Operations
   */
  
  /**
   * Get all plugins for current tenant
   */
  async getPlugins(options: TenantQueryOptions = {}): Promise<TenantOperationResult> {
    try {
      const plugins = await this.tenantDb.findMany('plugin', {
        include: {
          versions: {
            where: { isCurrent: true },
            take: 1
          },
          configurations: {
            where: { 
              environment: 'production',
              isActive: true 
            }
          },
          ...(options.includeCounts && {
            _count: {
              select: {
                versions: true,
                configurations: true,
                operations: true
              }
            }
          })
        },
        orderBy: {
          [options.sortBy || 'updatedAt']: options.sortOrder || 'desc'
        },
        take: options.maxResults || 50
      });

      return {
        success: true,
        data: plugins,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to retrieve plugins', error);
    }
  }

  /**
   * Get plugin by ID with tenant validation
   */
  async getPluginById(pluginId: string, includeVersions = false): Promise<TenantOperationResult> {
    try {
      const plugin = await this.tenantDb.findUnique('plugin', {
        where: { id: pluginId },
        include: {
          ...(includeVersions && {
            versions: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }),
          configurations: {
            where: { isActive: true }
          },
          securityMetadata: true,
          governance: true
        }
      });

      if (!plugin) {
        return {
          success: false,
          error: 'Plugin not found or access denied',
          tenantId: this.tenantContext?.tenant.id || 'system',
          timestamp: new Date()
        };
      }

      return {
        success: true,
        data: plugin,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to retrieve plugin', error);
    }
  }

  /**
   * Install plugin with tenant isolation
   */
  async installPlugin(
    pluginName: string, 
    version: string, 
    configuration?: any
  ): Promise<TenantOperationResult> {
    try {
      const result = await this.tenantDb.transaction(async (client) => {
        // Create or update plugin record
        const plugin = await client.create('plugin', {
          data: {
            name: pluginName,
            displayName: pluginName,
            description: `Plugin ${pluginName}`,
            category: 'OTHER',
            isInstalled: true,
            isEnabled: true,
            status: 'ACTIVE',
            installedAt: new Date(),
            installedBy: this.tenantContext?.user?.id || 'system'
          }
        });

        // Create plugin version
        const pluginVersion = await client.create('pluginVersion', {
          data: {
            pluginId: plugin.id,
            version: version,
            semverMajor: parseInt(version.split('.')[0] || '0'),
            semverMinor: parseInt(version.split('.')[1] || '0'),
            semverPatch: parseInt(version.split('.')[2] || '0'),
            isCurrent: true,
            isDeployed: true,
            status: 'DEPLOYED',
            installSource: 'NPM',
            deployedAt: new Date(),
            deployedBy: this.tenantContext?.user?.id || 'system'
          }
        });

        // Create configuration if provided
        if (configuration) {
          await client.create('pluginConfiguration', {
            data: {
              pluginId: plugin.id,
              environment: 'production',
              config: configuration,
              isActive: true,
              createdBy: this.tenantContext?.user?.id || 'system'
            }
          });
        }

        // Record installation operation
        await client.create('pluginOperation', {
          data: {
            pluginId: plugin.id,
            operationType: 'INSTALL',
            status: 'COMPLETED',
            version: version,
            performedBy: this.tenantContext?.user?.id || 'system',
            startedAt: new Date(),
            completedAt: new Date()
          }
        });

        // Record usage for tenant
        if (this.tenantContext) {
          await tenantManager.recordUsage(this.tenantContext.tenant.id, 'plugins', 1);
        }

        return { plugin, pluginVersion };
      });

      return {
        success: true,
        data: result,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to install plugin', error);
    }
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfiguration(
    pluginId: string, 
    configuration: any, 
    environment = 'production'
  ): Promise<TenantOperationResult> {
    try {
      // Verify plugin exists and user has access
      const plugin = await this.getPluginById(pluginId);
      if (!plugin.success) {
        return plugin;
      }

      const updatedConfig = await this.tenantDb.transaction(async (client) => {
        // Update or create configuration
        const config = await client.update('pluginConfiguration', {
          where: {
            pluginId_environment: {
              pluginId: pluginId,
              environment: environment
            }
          },
          data: {
            config: configuration,
            isActive: true,
            createdBy: this.tenantContext?.user?.id || 'system'
          }
        }).catch(async () => {
          // Create if doesn't exist
          return client.create('pluginConfiguration', {
            data: {
              pluginId: pluginId,
              environment: environment,
              config: configuration,
              isActive: true,
              createdBy: this.tenantContext?.user?.id || 'system'
            }
          });
        });

        // Record configuration operation
        await client.create('pluginOperation', {
          data: {
            pluginId: pluginId,
            operationType: 'CONFIGURE',
            status: 'COMPLETED',
            performedBy: this.tenantContext?.user?.id || 'system',
            parameters: { environment, configuration },
            startedAt: new Date(),
            completedAt: new Date()
          }
        });

        return config;
      });

      return {
        success: true,
        data: updatedConfig,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to update plugin configuration', error);
    }
  }

  /**
   * Get plugin operations history
   */
  async getPluginOperations(
    pluginId?: string,
    limit = 50
  ): Promise<TenantOperationResult> {
    try {
      const operations = await this.tenantDb.findMany('pluginOperation', {
        where: pluginId ? { pluginId } : {},
        include: {
          plugin: {
            select: {
              name: true,
              displayName: true
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        take: limit
      });

      return {
        success: true,
        data: operations,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to retrieve plugin operations', error);
    }
  }

  /**
   * Get plugin metrics for tenant
   */
  async getPluginMetrics(
    pluginId?: string,
    metricName?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<TenantOperationResult> {
    try {
      const whereClause: any = {};
      
      if (pluginId) whereClause.pluginId = pluginId;
      if (metricName) whereClause.metricName = metricName;
      if (timeRange) {
        whereClause.timestamp = {
          gte: timeRange.start,
          lte: timeRange.end
        };
      }

      const metrics = await this.tenantDb.findMany('pluginMetrics', {
        where: whereClause,
        include: {
          plugin: {
            select: {
              name: true,
              displayName: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 1000
      });

      return {
        success: true,
        data: metrics,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to retrieve plugin metrics', error);
    }
  }

  /**
   * User Management Operations
   */
  
  /**
   * Get users for current tenant
   */
  async getTenantUsers(options: TenantQueryOptions = {}): Promise<TenantOperationResult> {
    try {
      const users = await this.tenantDb.findMany('user', {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatar: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          ...(options.includeCounts && {
            _count: {
              select: {
                teamMemberships: true,
                ownedServices: true,
                sessions: true
              }
            }
          })
        },
        orderBy: {
          [options.sortBy || 'createdAt']: options.sortOrder || 'desc'
        },
        take: options.maxResults || 100
      });

      return {
        success: true,
        data: users,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to retrieve tenant users', error);
    }
  }

  /**
   * Audit and Compliance Operations
   */

  /**
   * Create audit log entry
   */
  async createAuditLog(
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: any
  ): Promise<TenantOperationResult> {
    try {
      const auditLog = await this.tenantDb.create('auditLog', {
        data: {
          userId: this.tenantContext?.user?.id,
          action,
          resource,
          resourceId,
          metadata,
          ipAddress: 'unknown', // Should be passed from request
          userAgent: 'unknown', // Should be passed from request
          timestamp: new Date()
        }
      });

      return {
        success: true,
        data: auditLog,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to create audit log', error);
    }
  }

  /**
   * Get audit logs for tenant
   */
  async getAuditLogs(
    filters: {
      action?: string;
      resource?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
    limit = 100
  ): Promise<TenantOperationResult> {
    try {
      const whereClause: any = {};
      
      if (filters.action) whereClause.action = filters.action;
      if (filters.resource) whereClause.resource = filters.resource;
      if (filters.userId) whereClause.userId = filters.userId;
      if (filters.startDate || filters.endDate) {
        whereClause.timestamp = {};
        if (filters.startDate) whereClause.timestamp.gte = filters.startDate;
        if (filters.endDate) whereClause.timestamp.lte = filters.endDate;
      }

      const auditLogs = await this.tenantDb.findMany('auditLog', {
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return {
        success: true,
        data: auditLogs,
        tenantId: this.tenantContext?.tenant.id || 'system',
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to retrieve audit logs', error);
    }
  }

  /**
   * Tenant Statistics and Analytics
   */

  /**
   * Get comprehensive tenant statistics
   */
  async getTenantStatistics(): Promise<TenantOperationResult> {
    try {
      if (!this.tenantContext) {
        return this.createErrorResult('Tenant context required for statistics');
      }

      const stats = await this.tenantDb.getTenantStats(this.tenantContext.tenant.id);

      // Get additional tenant-specific metrics
      const [pluginOperationsCount, activeUsersCount, recentActivityCount] = await Promise.all([
        this.tenantDb.count('pluginOperation', {
          where: {
            startedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        this.tenantDb.count('user', {
          where: {
            isActive: true,
            lastLogin: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }),
        this.tenantDb.count('auditLog', {
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ]);

      const extendedStats = {
        ...stats,
        pluginOperations30Days: pluginOperationsCount,
        activeUsers7Days: activeUsersCount,
        recentActivity24Hours: recentActivityCount,
        tenantInfo: {
          id: this.tenantContext.tenant.id,
          name: this.tenantContext.tenant.name,
          tier: this.tenantContext.tenant.tier,
          status: this.tenantContext.tenant.status
        }
      };

      return {
        success: true,
        data: extendedStats,
        tenantId: this.tenantContext.tenant.id,
        timestamp: new Date()
      };
    } catch (error) {
      return this.createErrorResult('Failed to retrieve tenant statistics', error);
    }
  }

  /**
   * Utility Methods
   */

  /**
   * Create standardized error result
   */
  private createErrorResult(message: string, error?: any): TenantOperationResult {
    console.error(`TenantPrismaService Error: ${message}`, error);
    
    return {
      success: false,
      error: message,
      tenantId: this.tenantContext?.tenant.id || 'unknown',
      timestamp: new Date()
    };
  }

  /**
   * Get current tenant context
   */
  getTenantContext(): TenantContext | null {
    return this.tenantContext;
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string): boolean {
    if (!this.tenantContext) return false;
    return this.tenantContext.permissions.includes(permission) ||
           this.tenantContext.permissions.includes('*') ||
           this.tenantContext.user?.role === 'OWNER';
  }

  /**
   * Disconnect database
   */
  async disconnect(): Promise<void> {
    await this.tenantDb.disconnect();
  }

  /**
   * Get underlying database instance (use with caution)
   */
  getDatabase(): TenantAwareDatabase {
    return this.tenantDb;
  }
}

/**
 * Factory function to create tenant service from request
 */
export async function createTenantServiceFromRequest(request: NextRequest): Promise<TenantPrismaService> {
  const service = new TenantPrismaService();
  await service.initializeFromRequest(request);
  return service;
}

/**
 * Factory function to create tenant service with context
 */
export function createTenantService(tenantContext: TenantContext): TenantPrismaService {
  const service = new TenantPrismaService();
  service.initializeWithContext(tenantContext);
  return service;
}

/**
 * Factory function to create system service (bypasses tenant restrictions)
 */
export function createSystemService(): TenantPrismaService {
  const service = new TenantPrismaService();
  service.initializeAsSystem();
  return service;
}

export default TenantPrismaService;