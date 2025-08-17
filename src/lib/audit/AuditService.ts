/**
 * Audit Service
 * Handles audit logging for compliance and security tracking
 */

import { PrismaClient } from '@prisma/client';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { NextRequest } from 'next/server';

export interface AuditLogEntry {
  userId?: string;
  tenantId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

export interface AuditQuery {
  tenantId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit service for tracking system events
 */
class AuditService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          tenantId: entry.tenantId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          metadata: entry.metadata || {},
          ipAddress: entry.ipAddress || 'unknown',
          userAgent: entry.userAgent || 'unknown',
          timestamp: entry.timestamp || new Date()
        }
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(query: AuditQuery): Promise<any[]> {
    try {
      const where: any = {};

      if (query.tenantId) where.tenantId = query.tenantId;
      if (query.userId) where.userId = query.userId;
      if (query.action) where.action = query.action;
      if (query.resource) where.resource = query.resource;
      
      if (query.startDate || query.endDate) {
        where.timestamp = {};
        if (query.startDate) where.timestamp.gte = query.startDate;
        if (query.endDate) where.timestamp.lte = query.endDate;
      }

      return await this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit || 100,
        skip: query.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Create audit log from request context
   */
  async logFromRequest(
    request: NextRequest, 
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const tenantContext = getTenantContext(request);
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await this.createAuditLog({
      userId: tenantContext?.user?.id,
      tenantId: tenantContext?.tenant.id,
      action,
      resource,
      resourceId,
      metadata,
      ipAddress,
      userAgent
    });
  }
}

// Global audit service instance
const auditService = new AuditService();

/**
 * Convenience function for creating audit logs
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  await auditService.createAuditLog(entry);
}

/**
 * Log audit entry from request context
 */
export async function logAuditFromRequest(
  request: NextRequest,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await auditService.logFromRequest(request, action, resource, resourceId, metadata);
}

export { auditService };
export default auditService;