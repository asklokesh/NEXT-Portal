/**
 * Tenant-Aware Database Layer with Row-Level Security
 * Provides complete tenant data isolation and context-aware database operations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { getTenantContext, TenantContext } from '@/lib/tenancy/TenantContext';
import { validateInput } from '@/lib/security/input-validation';
import { NextRequest } from 'next/server';

// Type definitions for tenant-aware operations
export interface TenantAwareQueryOptions {
  includeTenantFilter?: boolean;
  allowCrossTenanAccess?: boolean;
  validateTenantAccess?: boolean;
  skipPermissionCheck?: boolean;
}

export interface DatabaseContext {
  tenantId: string;
  userId?: string;
  userPermissions: string[];
  isSystemOperation?: boolean;
}

export interface TenantQueryFilters {
  tenantId?: string;
  tenantScope?: string[];
  excludeTenants?: string[];
}

/**
 * Tenant-Aware Database Client
 * Wraps Prisma with tenant context and row-level security
 */
export class TenantAwareDatabase {
  private prisma: PrismaClient;
  private context: DatabaseContext | null = null;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'pretty',
    });

    // Enable Prisma middleware for tenant filtering
    this.setupTenantMiddleware();
  }

  /**
   * Set tenant context for subsequent operations
   */
  setTenantContext(context: DatabaseContext): void {
    this.context = context;
  }

  /**
   * Get tenant context from request
   */
  async setContextFromRequest(request: NextRequest): Promise<void> {
    const tenantContext = getTenantContext(request);
    
    if (tenantContext) {
      this.context = {
        tenantId: tenantContext.tenant.id,
        userId: tenantContext.user?.id,
        userPermissions: tenantContext.permissions,
        isSystemOperation: false
      };
    }
  }

  /**
   * Create system context for administrative operations
   */
  createSystemContext(): void {
    this.context = {
      tenantId: 'system',
      userPermissions: ['*'],
      isSystemOperation: true
    };
  }

  /**
   * Validate tenant access and get filtered query args
   */
  private validateAndFilterQuery<T extends Record<string, any>>(
    args: T, 
    modelName: string,
    options: TenantAwareQueryOptions = {}
  ): T {
    if (!this.context && !options.skipPermissionCheck) {
      throw new Error('Database operation requires tenant context');
    }

    // Skip tenant filtering for system operations
    if (this.context?.isSystemOperation || options.skipPermissionCheck) {
      return args;
    }

    // Add tenant filter based on model
    const filteredArgs = this.addTenantFilter(args, modelName, options);
    
    // Validate tenant access
    if (options.validateTenantAccess && this.context) {
      this.validateTenantAccess(filteredArgs, modelName);
    }

    return filteredArgs;
  }

  /**
   * Add tenant filter to query arguments
   */
  private addTenantFilter<T extends Record<string, any>>(
    args: T,
    modelName: string,
    options: TenantAwareQueryOptions
  ): T {
    if (!this.context || options.includeTenantFilter === false) {
      return args;
    }

    const tenantFilter = this.getTenantFilterForModel(modelName, this.context.tenantId);
    
    if (!tenantFilter) {
      return args; // Model doesn't support tenant filtering
    }

    // Merge tenant filter with existing where clause
    const filteredArgs = { ...args };
    
    if (filteredArgs.where) {
      filteredArgs.where = {
        ...filteredArgs.where,
        ...tenantFilter
      };
    } else {
      filteredArgs.where = tenantFilter;
    }

    return filteredArgs;
  }

  /**
   * Get tenant filter for specific model
   */
  private getTenantFilterForModel(modelName: string, tenantId: string): Record<string, any> | null {
    // Models with direct tenantId field
    const directTenantModels = [
      'Plugin',
      'PluginGovernance',
      'PluginAnalytics',
      'Organization',
      'Subscription'
    ];

    // Models with tenant relationship through other models
    const indirectTenantModels: Record<string, string> = {
      'PluginVersion': 'plugin.tenantId',
      'PluginConfiguration': 'plugin.tenantId',
      'PluginOperation': 'plugin.tenantId',
      'PluginMetrics': 'plugin.tenantId',
      'PluginConfig': 'plugin.tenantId',
      'PluginDependency': 'plugin.tenantId',
      'PluginBackup': 'plugin.tenantId',
      'PluginApproval': 'plugin.tenantId',
      'PluginAlert': 'plugin.tenantId',
      'PluginWorkflow': 'plugin.tenantId',
      'PluginTestResult': 'plugin.tenantId',
      'PluginVulnerability': 'plugin.tenantId',
      'PluginPerformance': 'plugin.tenantId',
      'PluginEnvironment': 'plugin.tenantId',
      'ResourceUsage': 'organization.id',
      'Invoice': 'organization.id',
      'Payment': 'organization.id'
    };

    if (directTenantModels.includes(modelName)) {
      return { tenantId };
    }

    if (indirectTenantModels[modelName]) {
      const relationPath = indirectTenantModels[modelName].split('.');
      return this.buildNestedFilter(relationPath, tenantId);
    }

    return null; // Model doesn't support tenant filtering
  }

  /**
   * Build nested filter for tenant relationships
   */
  private buildNestedFilter(relationPath: string[], tenantId: string): Record<string, any> {
    if (relationPath.length === 1) {
      return { [relationPath[0]]: tenantId };
    }

    const [relation, ...rest] = relationPath;
    return {
      [relation]: this.buildNestedFilter(rest, tenantId)
    };
  }

  /**
   * Validate tenant access for specific operation
   */
  private validateTenantAccess(args: any, modelName: string): void {
    if (!this.context) return;

    // Validate tenant ID format
    if (this.context.tenantId && this.context.tenantId !== 'system') {
      const validation = validateInput.uuid(this.context.tenantId);
      if (!validation.valid) {
        throw new Error('Invalid tenant ID format');
      }
    }

    // Additional model-specific validation
    this.validateModelSpecificAccess(args, modelName);
  }

  /**
   * Model-specific access validation
   */
  private validateModelSpecificAccess(args: any, modelName: string): void {
    if (!this.context) return;

    const permissions = this.context.userPermissions;
    
    // Permission-based access control
    const permissionMap: Record<string, string[]> = {
      'Plugin': ['plugin:read', 'plugin:write', 'plugin:manage'],
      'PluginConfiguration': ['plugin:configure', 'plugin:manage'],
      'PluginOperation': ['plugin:operate', 'plugin:manage'],
      'Organization': ['tenant:manage', 'billing:read'],
      'Subscription': ['billing:read', 'billing:manage'],
      'User': ['user:read', 'user:manage'],
      'Team': ['team:read', 'team:manage']
    };

    const requiredPermissions = permissionMap[modelName];
    if (requiredPermissions) {
      const hasPermission = requiredPermissions.some(perm => 
        permissions.includes(perm) || 
        permissions.includes('*') ||
        permissions.includes('admin:all')
      );

      if (!hasPermission) {
        throw new Error(`Insufficient permissions for ${modelName} operations`);
      }
    }
  }

  /**
   * Setup Prisma middleware for automatic tenant filtering
   */
  private setupTenantMiddleware(): void {
    this.prisma.$use(async (params, next) => {
      // Skip middleware for system operations
      if (this.context?.isSystemOperation) {
        return next(params);
      }

      // Apply tenant filtering for relevant operations
      if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
        params.args = this.validateAndFilterQuery(params.args, params.model || '', {
          includeTenantFilter: true,
          validateTenantAccess: true
        });
      }

      // Apply tenant validation for write operations
      if (['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany'].includes(params.action)) {
        this.validateWriteOperation(params);
      }

      return next(params);
    });
  }

  /**
   * Validate write operations for tenant context
   */
  private validateWriteOperation(params: Prisma.MiddlewareParams): void {
    if (!this.context || this.context.isSystemOperation) return;

    const modelName = params.model || '';
    
    // Ensure tenant ID is set for create operations
    if (params.action === 'create' && this.getTenantFilterForModel(modelName, this.context.tenantId)) {
      if (!params.args.data.tenantId && modelName === 'Plugin') {
        params.args.data.tenantId = this.context.tenantId;
      }
    }

    // Validate tenant access for updates and deletes
    if (['update', 'delete', 'upsert'].includes(params.action)) {
      params.args = this.validateAndFilterQuery(params.args, modelName, {
        includeTenantFilter: true,
        validateTenantAccess: true
      });
    }
  }

  /**
   * Tenant-aware query methods
   */

  /**
   * Find many records with tenant filtering
   */
  async findMany<T extends keyof PrismaClient>(
    model: T,
    args: any,
    options: TenantAwareQueryOptions = {}
  ): Promise<any[]> {
    const filteredArgs = this.validateAndFilterQuery(args, model as string, options);
    return (this.prisma[model] as any).findMany(filteredArgs);
  }

  /**
   * Find unique record with tenant validation
   */
  async findUnique<T extends keyof PrismaClient>(
    model: T,
    args: any,
    options: TenantAwareQueryOptions = {}
  ): Promise<any> {
    const filteredArgs = this.validateAndFilterQuery(args, model as string, options);
    return (this.prisma[model] as any).findUnique(filteredArgs);
  }

  /**
   * Create record with tenant context
   */
  async create<T extends keyof PrismaClient>(
    model: T,
    args: any,
    options: TenantAwareQueryOptions = {}
  ): Promise<any> {
    // Add tenant ID to data if applicable
    if (this.context && !this.context.isSystemOperation) {
      const modelName = model as string;
      if (this.getTenantFilterForModel(modelName, this.context.tenantId) && modelName === 'Plugin') {
        args.data.tenantId = this.context.tenantId;
      }
    }

    const filteredArgs = this.validateAndFilterQuery(args, model as string, options);
    return (this.prisma[model] as any).create(filteredArgs);
  }

  /**
   * Update records with tenant filtering
   */
  async update<T extends keyof PrismaClient>(
    model: T,
    args: any,
    options: TenantAwareQueryOptions = {}
  ): Promise<any> {
    const filteredArgs = this.validateAndFilterQuery(args, model as string, options);
    return (this.prisma[model] as any).update(filteredArgs);
  }

  /**
   * Delete records with tenant filtering
   */
  async delete<T extends keyof PrismaClient>(
    model: T,
    args: any,
    options: TenantAwareQueryOptions = {}
  ): Promise<any> {
    const filteredArgs = this.validateAndFilterQuery(args, model as string, options);
    return (this.prisma[model] as any).delete(filteredArgs);
  }

  /**
   * Count records with tenant filtering
   */
  async count<T extends keyof PrismaClient>(
    model: T,
    args: any = {},
    options: TenantAwareQueryOptions = {}
  ): Promise<number> {
    const filteredArgs = this.validateAndFilterQuery(args, model as string, options);
    return (this.prisma[model] as any).count(filteredArgs);
  }

  /**
   * Execute raw query with tenant context validation
   */
  async executeRaw(
    query: string,
    params: any[] = [],
    options: { allowCrossTenant?: boolean } = {}
  ): Promise<any> {
    if (!options.allowCrossTenant && this.context && !this.context.isSystemOperation) {
      // Validate that raw queries don't bypass tenant security
      const sanitizedQuery = query.toLowerCase();
      if (sanitizedQuery.includes('select') && !sanitizedQuery.includes('tenant_id')) {
        console.warn('Raw query may bypass tenant isolation:', query);
      }
    }

    return this.prisma.$executeRawUnsafe(query, ...params);
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId: string): Promise<{
    pluginCount: number;
    userCount: number;
    storageUsed: number;
    apiCallsThisMonth: number;
  }> {
    const stats = await Promise.all([
      this.count('plugin', { where: { tenantId } }),
      this.count('user', {}), // Users are typically global
      this.prisma.resourceUsage.aggregate({
        where: {
          organizationId: tenantId,
          resourceType: 'STORAGE_GB',
          period: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { quantity: true }
      }),
      this.prisma.resourceUsage.aggregate({
        where: {
          organizationId: tenantId,
          resourceType: 'API_CALLS',
          period: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { quantity: true }
      })
    ]);

    return {
      pluginCount: stats[0],
      userCount: stats[1],
      storageUsed: Number(stats[2]._sum.quantity || 0),
      apiCallsThisMonth: Number(stats[3]._sum.quantity || 0)
    };
  }

  /**
   * Bulk operations with tenant safety
   */
  async bulkCreate<T extends keyof PrismaClient>(
    model: T,
    data: any[],
    options: TenantAwareQueryOptions = {}
  ): Promise<any> {
    if (!this.context?.isSystemOperation && this.context?.tenantId) {
      // Add tenant ID to all records if applicable
      data = data.map(item => ({
        ...item,
        tenantId: this.context!.tenantId
      }));
    }

    return (this.prisma[model] as any).createMany({
      data,
      skipDuplicates: true
    });
  }

  /**
   * Transaction with tenant context preservation
   */
  async transaction<T>(
    operations: (client: TenantAwareDatabase) => Promise<T>,
    options: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } = {}
  ): Promise<T> {
    return this.prisma.$transaction(async (prisma) => {
      const tenantAwareClient = new TenantAwareDatabase(prisma as PrismaClient);
      tenantAwareClient.setTenantContext(this.context!);
      return operations(tenantAwareClient);
    }, options);
  }

  /**
   * Get direct Prisma client (use with caution)
   */
  getPrismaClient(): PrismaClient {
    console.warn('Direct Prisma access bypasses tenant security');
    return this.prisma;
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

/**
 * Global tenant-aware database instance
 */
export const tenantDb = new TenantAwareDatabase();

/**
 * Create tenant-aware database instance with context
 */
export function createTenantDatabase(context: DatabaseContext): TenantAwareDatabase {
  const db = new TenantAwareDatabase();
  db.setTenantContext(context);
  return db;
}

/**
 * Utility function to create database context from tenant context
 */
export function createDatabaseContext(tenantContext: TenantContext, userId?: string): DatabaseContext {
  return {
    tenantId: tenantContext.tenant.id,
    userId: userId || tenantContext.user?.id,
    userPermissions: tenantContext.permissions,
    isSystemOperation: false
  };
}

/**
 * Database query builder with tenant awareness
 */
export class TenantQueryBuilder {
  private tenantId: string;
  private permissions: string[];

  constructor(tenantId: string, permissions: string[]) {
    this.tenantId = tenantId;
    this.permissions = permissions;
  }

  /**
   * Build plugin query with tenant and permission filters
   */
  buildPluginQuery(baseWhere: any = {}): any {
    const tenantFilter = { tenantId: this.tenantId };
    
    // Add permission-based visibility filters
    const visibilityFilter = this.permissions.includes('plugin:manage') 
      ? {} 
      : { tenantScope: { in: ['PUBLIC', 'PRIVATE'] } };

    return {
      ...baseWhere,
      ...tenantFilter,
      ...visibilityFilter
    };
  }

  /**
   * Build user query with tenant context
   */
  buildUserQuery(baseWhere: any = {}): any {
    // Users might be shared across tenants in some scenarios
    if (this.permissions.includes('user:manage:all')) {
      return baseWhere;
    }

    // Add tenant-specific user filtering if needed
    return {
      ...baseWhere,
      // Add tenant-specific user filters here
    };
  }

  /**
   * Build resource usage query for tenant
   */
  buildResourceUsageQuery(baseWhere: any = {}): any {
    return {
      ...baseWhere,
      organizationId: this.tenantId
    };
  }
}

export default TenantAwareDatabase;