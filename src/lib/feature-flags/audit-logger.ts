/**
 * Feature Flag Audit Logger
 * Comprehensive audit logging for compliance and governance
 */

import { AuditEntry, AuditAction, ChangeEntry } from './types';

export class AuditLogger {
  private auditStore: AuditEntry[] = [];

  /**
   * Log an audit entry
   */
  async log(entry: Omit<AuditEntry, 'id'>): Promise<void> {
    const auditEntry: AuditEntry = {
      id: this.generateId(),
      ...entry
    };

    // Store audit entry (in production, this would be a database or audit service)
    this.auditStore.push(auditEntry);

    // In production, you might want to:
    // 1. Store in dedicated audit database
    // 2. Send to audit service (e.g., AWS CloudTrail, Azure Activity Log)
    // 3. Forward to SIEM systems
    // 4. Trigger compliance workflows

    console.log('Audit Entry:', auditEntry);

    // Optionally send to external audit systems
    await this.forwardToExternalSystems(auditEntry);
  }

  /**
   * Get audit history for a flag
   */
  async getAuditHistory(flagKey: string, limit: number = 50): Promise<AuditEntry[]> {
    return this.auditStore
      .filter(entry => entry.flagKey === flagKey)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get audit entries by user
   */
  async getAuditByUser(userId: string, limit: number = 50): Promise<AuditEntry[]> {
    return this.auditStore
      .filter(entry => entry.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get audit entries by action type
   */
  async getAuditByAction(action: AuditAction, limit: number = 50): Promise<AuditEntry[]> {
    return this.auditStore
      .filter(entry => entry.action === action)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get audit entries within date range
   */
  async getAuditByDateRange(
    startDate: Date, 
    endDate: Date, 
    limit: number = 100
  ): Promise<AuditEntry[]> {
    return this.auditStore
      .filter(entry => 
        entry.timestamp >= startDate && 
        entry.timestamp <= endDate
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Search audit entries
   */
  async searchAudit(query: {
    flagKey?: string;
    userId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
  }): Promise<AuditEntry[]> {
    let filteredEntries = [...this.auditStore];

    if (query.flagKey) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.flagKey.toLowerCase().includes(query.flagKey!.toLowerCase())
      );
    }

    if (query.userId) {
      filteredEntries = filteredEntries.filter(entry => entry.userId === query.userId);
    }

    if (query.action) {
      filteredEntries = filteredEntries.filter(entry => entry.action === query.action);
    }

    if (query.startDate) {
      filteredEntries = filteredEntries.filter(entry => entry.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filteredEntries = filteredEntries.filter(entry => entry.timestamp <= query.endDate!);
    }

    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filteredEntries = filteredEntries.filter(entry =>
        entry.flagKey.toLowerCase().includes(searchTerm) ||
        entry.userName?.toLowerCase().includes(searchTerm) ||
        entry.reason?.toLowerCase().includes(searchTerm)
      );
    }

    return filteredEntries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, query.limit || 50);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(options: {
    startDate: Date;
    endDate: Date;
    flagKeys?: string[];
    users?: string[];
  }): Promise<{
    summary: {
      totalActions: number;
      uniqueFlags: number;
      uniqueUsers: number;
      actionBreakdown: Record<AuditAction, number>;
    };
    entries: AuditEntry[];
    riskAssessment: {
      highRiskActions: AuditEntry[];
      suspiciousPatterns: string[];
      complianceScore: number;
    };
  }> {
    let entries = await this.getAuditByDateRange(
      options.startDate,
      options.endDate,
      1000
    );

    if (options.flagKeys?.length) {
      entries = entries.filter(entry => 
        options.flagKeys!.includes(entry.flagKey)
      );
    }

    if (options.users?.length) {
      entries = entries.filter(entry => 
        options.users!.includes(entry.userId)
      );
    }

    // Calculate summary
    const uniqueFlags = new Set(entries.map(e => e.flagKey)).size;
    const uniqueUsers = new Set(entries.map(e => e.userId)).size;
    const actionBreakdown = entries.reduce((acc, entry) => {
      acc[entry.action] = (acc[entry.action] || 0) + 1;
      return acc;
    }, {} as Record<AuditAction, number>);

    // Risk assessment
    const highRiskActions = entries.filter(entry =>
      ['KILL_SWITCH_ACTIVATED', 'DELETED'].includes(entry.action)
    );

    const suspiciousPatterns: string[] = [];
    
    // Detect rapid flag modifications
    const flagModifications = entries
      .filter(e => e.action === 'UPDATED')
      .reduce((acc, entry) => {
        acc[entry.flagKey] = (acc[entry.flagKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    Object.entries(flagModifications).forEach(([flagKey, count]) => {
      if (count > 10) {
        suspiciousPatterns.push(`High frequency modifications on flag: ${flagKey} (${count} changes)`);
      }
    });

    // Detect bulk operations by single user
    const userActions = entries.reduce((acc, entry) => {
      const key = `${entry.userId}:${entry.timestamp.toDateString()}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(userActions).forEach(([key, count]) => {
      if (count > 20) {
        const [userId, date] = key.split(':');
        suspiciousPatterns.push(`High activity by user: ${userId} on ${date} (${count} actions)`);
      }
    });

    // Calculate compliance score (0-100)
    let complianceScore = 100;
    
    // Deduct points for suspicious patterns
    complianceScore -= suspiciousPatterns.length * 10;
    
    // Deduct points for high-risk actions without proper justification
    const unjustifiedHighRisk = highRiskActions.filter(action => !action.reason);
    complianceScore -= unjustifiedHighRisk.length * 15;

    complianceScore = Math.max(0, Math.min(100, complianceScore));

    return {
      summary: {
        totalActions: entries.length,
        uniqueFlags,
        uniqueUsers,
        actionBreakdown
      },
      entries,
      riskAssessment: {
        highRiskActions,
        suspiciousPatterns,
        complianceScore
      }
    };
  }

  /**
   * Export audit data for external systems
   */
  async exportAuditData(options: {
    format: 'json' | 'csv' | 'xml';
    startDate?: Date;
    endDate?: Date;
    flagKeys?: string[];
  }): Promise<string> {
    let entries = [...this.auditStore];

    if (options.startDate) {
      entries = entries.filter(e => e.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      entries = entries.filter(e => e.timestamp <= options.endDate!);
    }

    if (options.flagKeys?.length) {
      entries = entries.filter(e => options.flagKeys!.includes(e.flagKey));
    }

    switch (options.format) {
      case 'json':
        return JSON.stringify(entries, null, 2);
      
      case 'csv':
        return this.convertToCSV(entries);
      
      case 'xml':
        return this.convertToXML(entries);
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Forward audit entry to external systems
   */
  private async forwardToExternalSystems(entry: AuditEntry): Promise<void> {
    // In production, implement integrations with:
    // - SIEM systems (Splunk, QRadar, etc.)
    // - Cloud audit services (AWS CloudTrail, Azure Activity Log, GCP Audit Logs)
    // - Compliance platforms
    // - Slack/Teams notifications for critical actions
    
    if (this.isCriticalAction(entry)) {
      console.warn('CRITICAL ACTION DETECTED:', entry);
      // Send immediate alerts
    }
  }

  /**
   * Check if action is critical and requires immediate attention
   */
  private isCriticalAction(entry: AuditEntry): boolean {
    const criticalActions: AuditAction[] = [
      'KILL_SWITCH_ACTIVATED',
      'DELETED'
    ];

    return criticalActions.includes(entry.action);
  }

  /**
   * Convert audit entries to CSV format
   */
  private convertToCSV(entries: AuditEntry[]): string {
    if (!entries.length) {
      return '';
    }

    const headers = [
      'ID',
      'Action',
      'Flag Key',
      'User ID',
      'User Name',
      'Timestamp',
      'Reason',
      'Changes'
    ];

    const csvRows = [
      headers.join(','),
      ...entries.map(entry => [
        entry.id,
        entry.action,
        entry.flagKey,
        entry.userId,
        entry.userName || '',
        entry.timestamp.toISOString(),
        entry.reason || '',
        entry.changes ? JSON.stringify(entry.changes) : ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ];

    return csvRows.join('\n');
  }

  /**
   * Convert audit entries to XML format
   */
  private convertToXML(entries: AuditEntry[]): string {
    const xmlEntries = entries.map(entry => `
  <auditEntry>
    <id>${entry.id}</id>
    <action>${entry.action}</action>
    <flagKey>${entry.flagKey}</flagKey>
    <userId>${entry.userId}</userId>
    <userName>${entry.userName || ''}</userName>
    <timestamp>${entry.timestamp.toISOString()}</timestamp>
    <reason>${entry.reason || ''}</reason>
    <changes>${entry.changes ? JSON.stringify(entry.changes) : ''}</changes>
  </auditEntry>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<auditLog>
${xmlEntries}
</auditLog>`;
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}