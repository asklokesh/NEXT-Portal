/**
 * Database Audit Logger
 * 
 * Features:
 * - Comprehensive audit trail for all database operations
 * - Performance monitoring and analytics
 * - Security event logging
 * - Compliance support (GDPR, SOC2, etc.)
 */

import { getDatabaseManager } from './connection';
import type { QueryOptions } from './client';

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export class AuditLogger {
  private dbManager = getDatabaseManager();

  async logCreate(
    model: string,
    result: any,
    options: QueryOptions
  ): Promise<void> {
    await this.createAuditEntry({
      action: 'CREATE',
      resource: model,
      resourceId: result?.id,
      userId: options.userId,
      metadata: {
        ...options.metadata,
        createdData: this.sanitizeData(result)
      }
    });
  }

  async logUpdate(
    model: string,
    result: any,
    options: QueryOptions
  ): Promise<void> {
    await this.createAuditEntry({
      action: 'UPDATE',
      resource: model,
      resourceId: result?.id,
      userId: options.userId,
      metadata: {
        ...options.metadata,
        updatedData: this.sanitizeData(result)
      }
    });
  }

  async logUpsert(
    model: string,
    result: any,
    options: QueryOptions
  ): Promise<void> {
    await this.createAuditEntry({
      action: 'UPSERT',
      resource: model,
      resourceId: result?.id,
      userId: options.userId,
      metadata: {
        ...options.metadata,
        upsertedData: this.sanitizeData(result)
      }
    });
  }

  async logDelete(
    model: string,
    result: any,
    options: QueryOptions
  ): Promise<void> {
    await this.createAuditEntry({
      action: 'DELETE',
      resource: model,
      resourceId: result?.id,
      userId: options.userId,
      metadata: {
        ...options.metadata,
        deletedData: this.sanitizeData(result)
      }
    });
  }

  async logDeleteMany(
    model: string,
    result: any,
    options: QueryOptions
  ): Promise<void> {
    await this.createAuditEntry({
      action: 'DELETE_MANY',
      resource: model,
      userId: options.userId,
      metadata: {
        ...options.metadata,
        deletedCount: result?.count
      }
    });
  }

  async logCustomAction(
    action: string,
    resource: string,
    options: {
      userId?: string;
      resourceId?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.createAuditEntry({
      action: action.toUpperCase(),
      resource,
      resourceId: options.resourceId,
      userId: options.userId,
      metadata: options.metadata,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    });
  }

  private async createAuditEntry(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.dbManager.executeQuery(async (client) => {
        await client.auditLog.create({
          data: {
            userId: entry.userId,
            action: entry.action,
            resource: entry.resource,
            resourceId: entry.resourceId,
            metadata: entry.metadata as any,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            timestamp: new Date()
          }
        });
      });
    } catch (error) {
      // Don't let audit logging failures break the main operation
      console.error('Failed to create audit log entry:', error);
    }
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'secret',
      'token',
      'key',
      'hash',
      'salt',
      'privateKey',
      'accessToken',
      'refreshToken'
    ];

    const sanitized = { ...data };

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitizeObject(value);
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  // Query audit logs with filtering and pagination
  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    return await this.dbManager.executeQuery(async (client) => {
      const where: any = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.action) where.action = filters.action;
      if (filters.resource) where.resource = filters.resource;
      if (filters.resourceId) where.resourceId = filters.resourceId;
      
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      return await client.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0
      });
    }, true);
  }

  // Generate audit report
  async generateAuditReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    resourcesModified: Record<string, number>;
    topUsers: Array<{ userId: string; actionCount: number }>;
    timeline: Array<{ date: string; count: number }>;
  }> {
    return await this.dbManager.executeQuery(async (client) => {
      const [
        totalActions,
        actionsByType,
        resourcesModified,
        topUsers,
        timeline
      ] = await Promise.all([
        // Total actions
        client.auditLog.count({
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate
            }
          }
        }),

        // Actions by type
        client.auditLog.groupBy({
          by: ['action'],
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate
            }
          },
          _count: {
            action: true
          }
        }),

        // Resources modified
        client.auditLog.groupBy({
          by: ['resource'],
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate
            }
          },
          _count: {
            resource: true
          }
        }),

        // Top users by activity
        client.auditLog.groupBy({
          by: ['userId'],
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate
            },
            userId: {
              not: null
            }
          },
          _count: {
            userId: true
          },
          orderBy: {
            _count: {
              userId: 'desc'
            }
          },
          take: 10
        }),

        // Daily timeline
        client.$queryRaw<Array<{ date: string; count: number }>>`
          SELECT 
            DATE(timestamp) as date,
            COUNT(*) as count
          FROM audit_logs
          WHERE timestamp BETWEEN ${startDate} AND ${endDate}
          GROUP BY DATE(timestamp)
          ORDER BY date ASC
        `
      ]);

      return {
        totalActions,
        actionsByType: actionsByType.reduce((acc, item) => {
          acc[item.action] = item._count.action;
          return acc;
        }, {} as Record<string, number>),
        resourcesModified: resourcesModified.reduce((acc, item) => {
          acc[item.resource] = item._count.resource;
          return acc;
        }, {} as Record<string, number>),
        topUsers: topUsers.map(item => ({
          userId: item.userId!,
          actionCount: item._count.userId
        })),
        timeline: timeline.map(item => ({
          date: item.date,
          count: Number(item.count)
        }))
      };
    }, true);
  }

  // Clean up old audit logs based on retention policy
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return await this.dbManager.executeQuery(async (client) => {
      const result = await client.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });
      return result.count;
    });
  }
}