/**
 * Audit Logger
 * Comprehensive audit logging for permission decisions
 */

import { prisma } from '@/lib/db/client';
import { PermissionAuditLog, ResourceType, PermissionDecision, PermissionContext } from './types';
import { v4 as uuidv4 } from 'uuid';

export class AuditLogger {
  private batchQueue: PermissionAuditLog[];
  private batchSize = 100;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.batchQueue = [];
    this.startBatchProcessor();
  }

  /**
   * Log permission check
   */
  async log(entry: {
    userId: string;
    action: string;
    resource: ResourceType;
    resourceId?: string;
    decision: PermissionDecision;
    context?: PermissionContext;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const auditLog: PermissionAuditLog = {
      id: uuidv4(),
      timestamp: new Date(),
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      decision: entry.decision,
      context: entry.context,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent
    };

    this.batchQueue.push(auditLog);

    // Flush if batch is full
    if (this.batchQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    this.flushTimer = setInterval(async () => {
      if (this.batchQueue.length > 0) {
        await this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Flush batch to database
   */
  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      // Store in database
      await this.storeBatch(batch);
      
      // Send critical events to monitoring
      this.sendToMonitoring(batch);
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Retry logic could be added here
    }
  }

  /**
   * Store batch in database
   */
  private async storeBatch(batch: PermissionAuditLog[]): Promise<void> {
    try {
      // Convert to database format
      const records = batch.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        allowed: log.decision.allowed,
        reason: log.decision.reason,
        context: JSON.stringify(log.context),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent
      }));

      // Batch insert
      await prisma.$transaction(async (tx) => {
        // Create audit log table if not exists
        await tx.$executeRaw`
          CREATE TABLE IF NOT EXISTS permission_audit_logs (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            resource TEXT NOT NULL,
            resource_id TEXT,
            allowed BOOLEAN NOT NULL,
            reason TEXT,
            context TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;

        // Insert records
        for (const record of records) {
          await tx.$executeRaw`
            INSERT INTO permission_audit_logs (
              id, timestamp, user_id, action, resource, resource_id,
              allowed, reason, context, ip_address, user_agent
            ) VALUES (
              ${record.id}, ${record.timestamp}, ${record.userId},
              ${record.action}, ${record.resource}, ${record.resourceId},
              ${record.allowed}, ${record.reason}, ${record.context},
              ${record.ipAddress}, ${record.userAgent}
            )
          `;
        }
      });
    } catch (error) {
      console.error('Database storage failed:', error);
      // Fall back to file logging
      this.logToFile(batch);
    }
  }

  /**
   * Send critical events to monitoring
   */
  private sendToMonitoring(batch: PermissionAuditLog[]): void {
    // Filter critical events
    const criticalEvents = batch.filter(log => 
      !log.decision.allowed && 
      (log.resource === ResourceType.SETTINGS ||
       log.resource === ResourceType.ROLE ||
       log.resource === ResourceType.AUDIT)
    );

    if (criticalEvents.length > 0) {
      // Send to monitoring service
      console.warn('Critical permission denials:', criticalEvents);
      // Integration with Sentry/DataDog/etc would go here
    }
  }

  /**
   * Fallback file logging
   */
  private logToFile(batch: PermissionAuditLog[]): void {
    const fs = require('fs');
    const path = require('path');
    
    const logDir = path.join(process.cwd(), 'logs', 'audit');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const filename = path.join(
      logDir,
      `audit-${new Date().toISOString().split('T')[0]}.log`
    );

    const logEntries = batch.map(log => JSON.stringify(log)).join('\n') + '\n';
    fs.appendFileSync(filename, logEntries);
  }

  /**
   * Query audit logs
   */
  async query(filters: {
    userId?: string;
    resource?: ResourceType;
    startDate?: Date;
    endDate?: Date;
    allowed?: boolean;
    limit?: number;
  }): Promise<PermissionAuditLog[]> {
    try {
      let query = `
        SELECT * FROM permission_audit_logs
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.userId) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(filters.userId);
      }

      if (filters.resource) {
        query += ` AND resource = $${paramIndex++}`;
        params.push(filters.resource);
      }

      if (filters.startDate) {
        query += ` AND timestamp >= $${paramIndex++}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ` AND timestamp <= $${paramIndex++}`;
        params.push(filters.endDate);
      }

      if (filters.allowed !== undefined) {
        query += ` AND allowed = $${paramIndex++}`;
        params.push(filters.allowed);
      }

      query += ` ORDER BY timestamp DESC`;

      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }

      const results = await prisma.$queryRawUnsafe(query, ...params);
      return results as PermissionAuditLog[];
    } catch (error) {
      console.error('Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(timeRange: { start: Date; end: Date }): Promise<{
    totalChecks: number;
    deniedCount: number;
    allowedCount: number;
    topDeniedResources: Array<{ resource: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    try {
      const stats = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_checks,
          SUM(CASE WHEN allowed THEN 1 ELSE 0 END) as allowed_count,
          SUM(CASE WHEN NOT allowed THEN 1 ELSE 0 END) as denied_count
        FROM permission_audit_logs
        WHERE timestamp BETWEEN ${timeRange.start} AND ${timeRange.end}
      `;

      const topDenied = await prisma.$queryRaw`
        SELECT resource, COUNT(*) as count
        FROM permission_audit_logs
        WHERE NOT allowed
          AND timestamp BETWEEN ${timeRange.start} AND ${timeRange.end}
        GROUP BY resource
        ORDER BY count DESC
        LIMIT 5
      `;

      const topUsers = await prisma.$queryRaw`
        SELECT user_id, COUNT(*) as count
        FROM permission_audit_logs
        WHERE timestamp BETWEEN ${timeRange.start} AND ${timeRange.end}
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 10
      `;

      return {
        totalChecks: (stats as any)[0]?.total_checks || 0,
        deniedCount: (stats as any)[0]?.denied_count || 0,
        allowedCount: (stats as any)[0]?.allowed_count || 0,
        topDeniedResources: topDenied as any,
        topUsers: topUsers as any
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalChecks: 0,
        deniedCount: 0,
        allowedCount: 0,
        topDeniedResources: [],
        topUsers: []
      };
    }
  }

  /**
   * Cleanup old logs
   */
  async cleanup(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await prisma.$executeRaw`
        DELETE FROM permission_audit_logs
        WHERE timestamp < ${cutoffDate}
      `;
    } catch (error) {
      console.error('Failed to cleanup audit logs:', error);
    }
  }

  /**
   * Stop batch processor
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Flush remaining logs
    this.flush().catch(console.error);
  }
}