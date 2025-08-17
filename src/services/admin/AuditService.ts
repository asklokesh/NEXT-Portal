/**
 * Enterprise Audit Service
 * Comprehensive audit logging and compliance management
 */

import { prisma } from '@/lib/db/client';
import { EventEmitter } from 'events';
import { CacheService } from '@/lib/cache/CacheService';
import crypto from 'crypto';

export interface AuditLogEntry {
  id?: string;
  timestamp?: Date;
  userId: string;
  action: string;
  targetId?: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  result?: 'success' | 'failure';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AuditSearchParams {
  userId?: string;
  action?: string;
  resource?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  result?: 'success' | 'failure';
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'action' | 'userId';
  sortOrder?: 'asc' | 'desc';
}

export interface ComplianceReport {
  id: string;
  name: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalEvents: number;
    uniqueUsers: number;
    successRate: number;
    failureRate: number;
    criticalEvents: number;
    suspiciousActivities: number;
  };
  eventsByCategory: Record<string, number>;
  userActivity: Array<{
    userId: string;
    eventCount: number;
    lastActivity: Date;
  }>;
  compliance: {
    dataRetention: boolean;
    encryption: boolean;
    accessControl: boolean;
    auditIntegrity: boolean;
  };
  recommendations: string[];
  generatedAt: Date;
  generatedBy: string;
}

export interface AuditRetentionPolicy {
  id: string;
  name: string;
  description: string;
  retentionDays: number;
  archiveAfterDays?: number;
  deleteAfterDays?: number;
  categories?: string[];
  enabled: boolean;
}

export interface AuditAlert {
  id: string;
  name: string;
  description: string;
  condition: {
    field: string;
    operator: string;
    value: any;
  }[];
  actions: {
    type: 'email' | 'webhook' | 'slack';
    config: Record<string, any>;
  }[];
  enabled: boolean;
  lastTriggered?: Date;
}

export class AuditService extends EventEmitter {
  private cacheService: CacheService;
  private retentionPolicies: Map<string, AuditRetentionPolicy>;
  private alerts: Map<string, AuditAlert>;
  private readonly BATCH_SIZE = 100;
  private pendingLogs: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.cacheService = new CacheService();
    this.retentionPolicies = new Map();
    this.alerts = new Map();
    this.initializeService();
  }

  /**
   * Initialize the audit service
   */
  private async initializeService(): Promise<void> {
    // Load retention policies
    await this.loadRetentionPolicies();
    
    // Load alert rules
    await this.loadAlertRules();
    
    // Start batch processing
    this.startBatchProcessing();
    
    // Schedule retention tasks
    this.scheduleRetentionTasks();
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Add metadata
      const enrichedEntry: AuditLogEntry = {
        ...entry,
        id: this.generateAuditId(),
        timestamp: new Date(),
        result: entry.result || 'success',
        metadata: {
          ...entry.metadata,
          hash: this.generateHash(entry)
        }
      };

      // Add to pending logs for batch processing
      this.pendingLogs.push(enrichedEntry);

      // Check if batch is full
      if (this.pendingLogs.length >= this.BATCH_SIZE) {
        await this.flushLogs();
      }

      // Check alert conditions
      await this.checkAlerts(enrichedEntry);

      // Emit event
      this.emit('audit:logged', enrichedEntry);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Audit logging should not fail operations
    }
  }

  /**
   * Search audit logs
   */
  async search(params: AuditSearchParams): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const {
        userId,
        action,
        resource,
        targetId,
        startDate,
        endDate,
        result,
        page = 1,
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = params;

      // Build query
      const where: any = {
        AND: [
          userId ? { userId } : {},
          action ? { action } : {},
          resource ? { resource } : {},
          targetId ? { resourceId: targetId } : {},
          startDate ? { timestamp: { gte: startDate } } : {},
          endDate ? { timestamp: { lte: endDate } } : {},
          result ? { metadata: { path: ['result'], equals: result } } : {}
        ].filter(condition => Object.keys(condition).length > 0)
      };

      // Get total count
      const total = await prisma.auditLog.count({ where });

      // Get logs
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { [sortBy === 'timestamp' ? 'timestamp' : sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          userId: log.userId || '',
          action: log.action,
          targetId: log.resourceId || undefined,
          resource: log.resource,
          details: log.metadata as any,
          ipAddress: log.ipAddress || undefined,
          userAgent: log.userAgent || undefined
        })),
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Failed to search audit logs:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      // Get all logs in period
      const logs = await prisma.auditLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calculate metrics
      const totalEvents = logs.length;
      const uniqueUsers = new Set(logs.map(l => l.userId).filter(Boolean)).size;
      const successCount = logs.filter(l => 
        (l.metadata as any)?.result === 'success'
      ).length;
      const failureCount = logs.filter(l => 
        (l.metadata as any)?.result === 'failure'
      ).length;
      const successRate = totalEvents > 0 ? (successCount / totalEvents) * 100 : 0;
      const failureRate = totalEvents > 0 ? (failureCount / totalEvents) * 100 : 0;

      // Count critical events
      const criticalActions = [
        'USER_DELETE',
        'ROLE_GRANT_ADMIN',
        'POLICY_DISABLE',
        'SECURITY_BREACH',
        'DATA_EXPORT'
      ];
      const criticalEvents = logs.filter(l => 
        criticalActions.includes(l.action)
      ).length;

      // Detect suspicious activities
      const suspiciousActivities = await this.detectSuspiciousActivities(logs);

      // Group events by category
      const eventsByCategory = logs.reduce((acc, log) => {
        const category = this.categorizeAction(log.action);
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get user activity
      const userActivity = await this.getUserActivity(logs);

      // Check compliance status
      const compliance = {
        dataRetention: await this.checkDataRetentionCompliance(),
        encryption: await this.checkEncryptionCompliance(),
        accessControl: await this.checkAccessControlCompliance(),
        auditIntegrity: await this.checkAuditIntegrityCompliance()
      };

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        failureRate,
        criticalEvents,
        suspiciousActivities: suspiciousActivities.length,
        compliance
      });

      const report: ComplianceReport = {
        id: this.generateReportId(),
        name: `Compliance Report ${startDate.toISOString()} - ${endDate.toISOString()}`,
        period: { start: startDate, end: endDate },
        metrics: {
          totalEvents,
          uniqueUsers,
          successRate,
          failureRate,
          criticalEvents,
          suspiciousActivities: suspiciousActivities.length
        },
        eventsByCategory,
        userActivity: userActivity.slice(0, 10), // Top 10 users
        compliance,
        recommendations,
        generatedAt: new Date(),
        generatedBy
      };

      // Store report
      await this.storeReport(report);

      // Emit event
      this.emit('compliance:report-generated', report);

      return report;
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(
    params: AuditSearchParams,
    format: 'json' | 'csv'
  ): Promise<Buffer> {
    try {
      const { logs } = await this.search({ ...params, limit: 10000 });

      if (format === 'json') {
        return Buffer.from(JSON.stringify(logs, null, 2));
      } else {
        // CSV format
        const headers = [
          'ID',
          'Timestamp',
          'User ID',
          'Action',
          'Resource',
          'Target ID',
          'Result',
          'IP Address',
          'User Agent'
        ];

        const rows = logs.map(log => [
          log.id,
          log.timestamp?.toISOString(),
          log.userId,
          log.action,
          log.resource || '',
          log.targetId || '',
          log.result || '',
          log.ipAddress || '',
          log.userAgent || ''
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return Buffer.from(csv);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  /**
   * Create retention policy
   */
  async createRetentionPolicy(
    policy: AuditRetentionPolicy,
    createdBy: string
  ): Promise<void> {
    try {
      // Store policy
      await prisma.auditRetentionPolicy.create({
        data: {
          ...policy,
          createdBy,
          createdAt: new Date()
        }
      });

      // Update cache
      this.retentionPolicies.set(policy.id, policy);

      // Log action
      await this.log({
        action: 'RETENTION_POLICY_CREATE',
        userId: createdBy,
        targetId: policy.id,
        details: policy
      });

      // Emit event
      this.emit('retention:policy-created', policy);
    } catch (error) {
      console.error('Failed to create retention policy:', error);
      throw error;
    }
  }

  /**
   * Create alert rule
   */
  async createAlert(alert: AuditAlert, createdBy: string): Promise<void> {
    try {
      // Store alert
      await prisma.auditAlert.create({
        data: {
          ...alert,
          createdBy,
          createdAt: new Date()
        }
      });

      // Update cache
      this.alerts.set(alert.id, alert);

      // Log action
      await this.log({
        action: 'ALERT_CREATE',
        userId: createdBy,
        targetId: alert.id,
        details: alert
      });

      // Emit event
      this.emit('alert:created', alert);
    } catch (error) {
      console.error('Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(period: 'day' | 'week' | 'month' | 'year'): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByUser: Record<string, number>;
    eventsByHour: Record<string, number>;
    trends: {
      period: string;
      count: number;
    }[];
  }> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      const logs = await prisma.auditLog.findMany({
        where: {
          timestamp: { gte: startDate }
        }
      });

      // Calculate statistics
      const totalEvents = logs.length;

      const eventsByAction = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const eventsByUser = logs.reduce((acc, log) => {
        if (log.userId) {
          acc[log.userId] = (acc[log.userId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const eventsByHour = logs.reduce((acc, log) => {
        const hour = log.timestamp.getHours().toString();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate trends
      const trends = this.calculateTrends(logs, period);

      return {
        totalEvents,
        eventsByAction,
        eventsByUser,
        eventsByHour,
        trends
      };
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async flushLogs(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      await prisma.auditLog.createMany({
        data: logsToFlush.map(log => ({
          id: log.id!,
          userId: log.userId,
          action: log.action,
          resource: log.resource || '',
          resourceId: log.targetId,
          metadata: log.details,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          timestamp: log.timestamp!
        }))
      });
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Re-add logs to pending queue
      this.pendingLogs.unshift(...logsToFlush);
    }
  }

  private startBatchProcessing(): void {
    // Flush logs every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000);
  }

  private async loadRetentionPolicies(): Promise<void> {
    // Default retention policy
    this.retentionPolicies.set('default', {
      id: 'default',
      name: 'Default Retention Policy',
      description: 'Default audit log retention',
      retentionDays: 90,
      archiveAfterDays: 30,
      deleteAfterDays: 365,
      enabled: true
    });
  }

  private async loadAlertRules(): Promise<void> {
    // Load from database or config
    // Example alert for failed login attempts
    this.alerts.set('failed-logins', {
      id: 'failed-logins',
      name: 'Multiple Failed Logins',
      description: 'Alert on multiple failed login attempts',
      condition: [
        { field: 'action', operator: 'eq', value: 'LOGIN_FAILED' },
        { field: 'count', operator: 'gt', value: 5 }
      ],
      actions: [
        { type: 'email', config: { to: 'security@example.com' } }
      ],
      enabled: true
    });
  }

  private scheduleRetentionTasks(): void {
    // Run retention tasks daily
    setInterval(() => {
      this.applyRetentionPolicies();
    }, 24 * 60 * 60 * 1000);
  }

  private async applyRetentionPolicies(): Promise<void> {
    for (const policy of this.retentionPolicies.values()) {
      if (!policy.enabled) continue;

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        // Archive old logs
        if (policy.archiveAfterDays) {
          const archiveDate = new Date();
          archiveDate.setDate(archiveDate.getDate() - policy.archiveAfterDays);
          
          // Archive logic here
        }

        // Delete very old logs
        if (policy.deleteAfterDays) {
          const deleteDate = new Date();
          deleteDate.setDate(deleteDate.getDate() - policy.deleteAfterDays);
          
          await prisma.auditLog.deleteMany({
            where: {
              timestamp: { lt: deleteDate }
            }
          });
        }
      } catch (error) {
        console.error('Failed to apply retention policy:', error);
      }
    }
  }

  private async checkAlerts(entry: AuditLogEntry): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      try {
        const shouldTrigger = await this.evaluateAlertConditions(alert, entry);
        if (shouldTrigger) {
          await this.triggerAlert(alert, entry);
        }
      } catch (error) {
        console.error('Failed to check alert:', error);
      }
    }
  }

  private async evaluateAlertConditions(
    alert: AuditAlert,
    entry: AuditLogEntry
  ): Promise<boolean> {
    // Simple condition evaluation
    for (const condition of alert.condition) {
      const value = (entry as any)[condition.field];
      
      switch (condition.operator) {
        case 'eq':
          if (value !== condition.value) return false;
          break;
        case 'gt':
          if (!(value > condition.value)) return false;
          break;
        case 'lt':
          if (!(value < condition.value)) return false;
          break;
        default:
          return false;
      }
    }
    
    return true;
  }

  private async triggerAlert(alert: AuditAlert, entry: AuditLogEntry): Promise<void> {
    for (const action of alert.actions) {
      switch (action.type) {
        case 'email':
          // Send email notification
          break;
        case 'webhook':
          // Call webhook
          break;
        case 'slack':
          // Send Slack message
          break;
      }
    }

    // Update last triggered
    alert.lastTriggered = new Date();
    
    // Emit event
    this.emit('alert:triggered', { alert, entry });
  }

  private async detectSuspiciousActivities(logs: any[]): Promise<any[]> {
    const suspicious = [];
    
    // Detect rapid fire actions
    const userActions = new Map<string, Date[]>();
    for (const log of logs) {
      if (!log.userId) continue;
      
      if (!userActions.has(log.userId)) {
        userActions.set(log.userId, []);
      }
      userActions.get(log.userId)!.push(log.timestamp);
    }
    
    // Check for too many actions in short time
    for (const [userId, timestamps] of userActions.entries()) {
      timestamps.sort((a, b) => a.getTime() - b.getTime());
      
      for (let i = 1; i < timestamps.length; i++) {
        const timeDiff = timestamps[i].getTime() - timestamps[i - 1].getTime();
        if (timeDiff < 1000) { // Less than 1 second
          suspicious.push({
            type: 'rapid_actions',
            userId,
            timestamp: timestamps[i]
          });
        }
      }
    }
    
    // Detect unusual access patterns
    const nightTimeAccess = logs.filter(log => {
      const hour = log.timestamp.getHours();
      return hour >= 0 && hour <= 6; // Midnight to 6 AM
    });
    
    if (nightTimeAccess.length > logs.length * 0.1) { // More than 10% at night
      suspicious.push({
        type: 'unusual_hours',
        count: nightTimeAccess.length
      });
    }
    
    return suspicious;
  }

  private async getUserActivity(logs: any[]): Promise<any[]> {
    const activity = new Map<string, { count: number; lastActivity: Date }>();
    
    for (const log of logs) {
      if (!log.userId) continue;
      
      const existing = activity.get(log.userId) || { count: 0, lastActivity: log.timestamp };
      existing.count++;
      if (log.timestamp > existing.lastActivity) {
        existing.lastActivity = log.timestamp;
      }
      activity.set(log.userId, existing);
    }
    
    return Array.from(activity.entries())
      .map(([userId, data]) => ({
        userId,
        eventCount: data.count,
        lastActivity: data.lastActivity
      }))
      .sort((a, b) => b.eventCount - a.eventCount);
  }

  private categorizeAction(action: string): string {
    if (action.startsWith('USER_')) return 'User Management';
    if (action.startsWith('ROLE_')) return 'Role Management';
    if (action.startsWith('PERMISSION_')) return 'Permission Management';
    if (action.startsWith('AUTH_')) return 'Authentication';
    if (action.startsWith('PLUGIN_')) return 'Plugin Management';
    if (action.startsWith('TEMPLATE_')) return 'Template Management';
    if (action.startsWith('SERVICE_')) return 'Service Management';
    return 'Other';
  }

  private async checkDataRetentionCompliance(): Promise<boolean> {
    // Check if retention policies are being enforced
    const oldestLog = await prisma.auditLog.findFirst({
      orderBy: { timestamp: 'asc' }
    });
    
    if (!oldestLog) return true;
    
    const daysSinceOldest = Math.floor(
      (Date.now() - oldestLog.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Check against max retention policy
    const maxRetention = Math.max(
      ...Array.from(this.retentionPolicies.values())
        .filter(p => p.enabled)
        .map(p => p.deleteAfterDays || p.retentionDays)
    );
    
    return daysSinceOldest <= maxRetention;
  }

  private async checkEncryptionCompliance(): Promise<boolean> {
    // Check if audit logs are encrypted at rest
    // This would check database encryption settings
    return true; // Placeholder
  }

  private async checkAccessControlCompliance(): Promise<boolean> {
    // Check if audit logs have proper access controls
    // This would verify that only authorized users can access audit logs
    return true; // Placeholder
  }

  private async checkAuditIntegrityCompliance(): Promise<boolean> {
    // Check if audit logs have integrity protection
    // Verify hashes and signatures
    const recentLogs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { timestamp: 'desc' }
    });
    
    for (const log of recentLogs) {
      const metadata = log.metadata as any;
      if (!metadata?.hash) return false;
      
      // Verify hash
      const calculatedHash = this.generateHash({
        userId: log.userId!,
        action: log.action,
        resource: log.resource,
        targetId: log.resourceId || undefined
      });
      
      if (metadata.hash !== calculatedHash) return false;
    }
    
    return true;
  }

  private generateRecommendations(data: any): string[] {
    const recommendations = [];
    
    if (data.failureRate > 10) {
      recommendations.push('High failure rate detected. Review authentication and authorization policies.');
    }
    
    if (data.criticalEvents > 50) {
      recommendations.push('High number of critical events. Implement additional monitoring and alerts.');
    }
    
    if (data.suspiciousActivities > 10) {
      recommendations.push('Suspicious activities detected. Review security policies and user behavior.');
    }
    
    if (!data.compliance.dataRetention) {
      recommendations.push('Data retention policy not compliant. Review and update retention settings.');
    }
    
    if (!data.compliance.encryption) {
      recommendations.push('Encryption not properly configured. Enable encryption for audit logs.');
    }
    
    if (!data.compliance.accessControl) {
      recommendations.push('Access control issues detected. Review and restrict audit log access.');
    }
    
    if (!data.compliance.auditIntegrity) {
      recommendations.push('Audit integrity compromised. Implement tamper-proof logging.');
    }
    
    return recommendations;
  }

  private calculateTrends(logs: any[], period: string): any[] {
    const trends = [];
    const now = new Date();
    
    // Group logs by period
    const groups = new Map<string, number>();
    
    for (const log of logs) {
      let key: string;
      
      switch (period) {
        case 'day':
          key = log.timestamp.getHours().toString();
          break;
        case 'week':
        case 'month':
          key = log.timestamp.toISOString().split('T')[0];
          break;
        case 'year':
          key = `${log.timestamp.getFullYear()}-${log.timestamp.getMonth() + 1}`;
          break;
        default:
          key = log.timestamp.toISOString();
      }
      
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    
    // Convert to array
    for (const [period, count] of groups.entries()) {
      trends.push({ period, count });
    }
    
    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  private async storeReport(report: ComplianceReport): Promise<void> {
    // Store report in database
    await prisma.complianceReport.create({
      data: {
        id: report.id,
        name: report.name,
        content: report as any,
        generatedBy: report.generatedBy,
        generatedAt: report.generatedAt
      }
    });
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateHash(data: any): string {
    const content = JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    // Flush pending logs
    await this.flushLogs();
    
    // Clear intervals
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}