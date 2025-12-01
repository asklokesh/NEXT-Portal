/**
 * Audit Logging Service
 * Enterprise-grade audit trail management
 */

import {
  AuditEvent,
  AuditEventType,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AuditActor,
  AuditTarget,
  AuditDetails,
  AuditMetadata,
  AuditQuery,
  AuditQueryResult,
  AuditAggregations,
  AuditExportConfig,
  AuditExport,
  AuditAlert,
  AuditAlertTriggered,
  ComplianceReport,
  ComplianceReportType,
  ComplianceFramework,
} from './types';

// ============================================================================
// Audit Service
// ============================================================================

export class AuditService {
  private events: AuditEvent[] = [];
  private alerts: Map<string, AuditAlert> = new Map();
  private exports: Map<string, AuditExport> = new Map();
  private triggeredAlerts: AuditAlertTriggered[] = [];
  private maxEventsInMemory = 10000;

  constructor() {
    this.initializeSampleData();
  }

  // ============================================================================
  // Event Logging
  // ============================================================================

  async log(
    eventType: AuditEventType,
    actor: AuditActor,
    target: AuditTarget,
    action: string,
    outcome: AuditOutcome,
    details: Partial<AuditDetails> = {},
    metadata: Partial<AuditMetadata> = {}
  ): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      eventType,
      category: this.categorizeEvent(eventType),
      severity: this.determineSeverity(eventType, outcome),
      actor,
      target,
      action,
      outcome,
      details: {
        description: details.description || this.generateDescription(eventType, actor, target, action),
        changes: details.changes,
        request: details.request,
        response: details.response,
        error: details.error,
        context: details.context,
      },
      metadata: {
        correlationId: metadata.correlationId || this.generateCorrelationId(),
        traceId: metadata.traceId,
        spanId: metadata.spanId,
        requestId: metadata.requestId,
        tenantId: metadata.tenantId,
        organizationId: metadata.organizationId,
        environment: metadata.environment || process.env.NODE_ENV,
        version: metadata.version || '1.0.0',
        source: metadata.source || 'api',
        tags: metadata.tags,
        retention: metadata.retention || { policy: 'standard' },
      },
    };

    // Store event
    this.events.unshift(event);

    // Trim events if exceeding max
    if (this.events.length > this.maxEventsInMemory) {
      this.events = this.events.slice(0, this.maxEventsInMemory);
    }

    // Check alerts
    await this.checkAlerts(event);

    return event;
  }

  // Convenience methods for common events
  async logAuth(
    eventType: Extract<AuditEventType, `auth.${string}`>,
    actor: AuditActor,
    outcome: AuditOutcome,
    details?: Partial<AuditDetails>
  ): Promise<AuditEvent> {
    return this.log(
      eventType,
      actor,
      { type: 'system', id: 'auth', name: 'Authentication' },
      eventType.replace('auth.', ''),
      outcome,
      details
    );
  }

  async logResourceChange(
    action: 'created' | 'updated' | 'deleted' | 'viewed',
    actor: AuditActor,
    target: AuditTarget,
    changes?: AuditDetails['changes'],
    outcome: AuditOutcome = 'success'
  ): Promise<AuditEvent> {
    return this.log(
      `resource.${action}` as AuditEventType,
      actor,
      target,
      action,
      outcome,
      { changes }
    );
  }

  async logPermissionChange(
    action: 'granted' | 'denied' | 'revoked',
    actor: AuditActor,
    targetUser: AuditTarget,
    permission: string,
    outcome: AuditOutcome = 'success'
  ): Promise<AuditEvent> {
    const eventType = action === 'denied'
      ? 'authz.permission_denied'
      : action === 'granted'
        ? 'authz.permission_granted'
        : 'authz.role_revoked';

    return this.log(
      eventType,
      actor,
      targetUser,
      `Permission ${action}: ${permission}`,
      outcome,
      { context: { permission } }
    );
  }

  // ============================================================================
  // Event Querying
  // ============================================================================

  async query(query: AuditQuery): Promise<AuditQueryResult> {
    let filtered = [...this.events];

    // Apply filters
    if (query.startTime) {
      filtered = filtered.filter(e => e.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      filtered = filtered.filter(e => e.timestamp <= query.endTime!);
    }
    if (query.eventTypes?.length) {
      filtered = filtered.filter(e => query.eventTypes!.includes(e.eventType));
    }
    if (query.categories?.length) {
      filtered = filtered.filter(e => query.categories!.includes(e.category));
    }
    if (query.severities?.length) {
      filtered = filtered.filter(e => query.severities!.includes(e.severity));
    }
    if (query.outcomes?.length) {
      filtered = filtered.filter(e => query.outcomes!.includes(e.outcome));
    }
    if (query.actorIds?.length) {
      filtered = filtered.filter(e => query.actorIds!.includes(e.actor.id));
    }
    if (query.actorTypes?.length) {
      filtered = filtered.filter(e => query.actorTypes!.includes(e.actor.type));
    }
    if (query.targetIds?.length) {
      filtered = filtered.filter(e => query.targetIds!.includes(e.target.id));
    }
    if (query.targetTypes?.length) {
      filtered = filtered.filter(e => query.targetTypes!.includes(e.target.type));
    }
    if (query.correlationId) {
      filtered = filtered.filter(e => e.metadata.correlationId === query.correlationId);
    }
    if (query.tenantId) {
      filtered = filtered.filter(e => e.metadata.tenantId === query.tenantId);
    }
    if (query.searchText) {
      const search = query.searchText.toLowerCase();
      filtered = filtered.filter(e =>
        e.action.toLowerCase().includes(search) ||
        e.details.description.toLowerCase().includes(search) ||
        e.actor.displayName?.toLowerCase().includes(search) ||
        e.target.name?.toLowerCase().includes(search)
      );
    }

    // Sort
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (query.sortBy) {
        case 'severity':
          const severityOrder = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
          return (severityOrder[a.severity] - severityOrder[b.severity]) * sortOrder;
        case 'eventType':
          return a.eventType.localeCompare(b.eventType) * sortOrder;
        default:
          return a.timestamp.localeCompare(b.timestamp) * sortOrder * -1;
      }
    });

    // Calculate aggregations
    const aggregations = this.calculateAggregations(filtered);

    // Paginate
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      total: filtered.length,
      page,
      pageSize,
      hasMore: start + pageSize < filtered.length,
      aggregations,
    };
  }

  async getEvent(eventId: string): Promise<AuditEvent | null> {
    return this.events.find(e => e.id === eventId) || null;
  }

  async getEventsByCorrelation(correlationId: string): Promise<AuditEvent[]> {
    return this.events.filter(e => e.metadata.correlationId === correlationId);
  }

  private calculateAggregations(events: AuditEvent[]): AuditAggregations {
    const byEventType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const actorCounts: Record<string, { name: string; count: number }> = {};
    const hourCounts: Record<string, number> = {};

    for (const event of events) {
      byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1;
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byOutcome[event.outcome] = (byOutcome[event.outcome] || 0) + 1;

      if (!actorCounts[event.actor.id]) {
        actorCounts[event.actor.id] = {
          name: event.actor.displayName || event.actor.id,
          count: 0,
        };
      }
      actorCounts[event.actor.id].count++;

      const hour = event.timestamp.substring(0, 13);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    return {
      byEventType,
      byCategory,
      bySeverity,
      byOutcome,
      byActor: Object.entries(actorCounts)
        .map(([id, data]) => ({ id, name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      byHour: Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
    };
  }

  // ============================================================================
  // Export Management
  // ============================================================================

  async createExport(config: AuditExportConfig): Promise<AuditExport> {
    const exportJob: AuditExport = {
      id: `export-${Date.now()}`,
      config,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.exports.set(exportJob.id, exportJob);

    // Simulate async export processing
    this.processExport(exportJob.id);

    return exportJob;
  }

  private async processExport(exportId: string): Promise<void> {
    const exportJob = this.exports.get(exportId);
    if (!exportJob) return;

    exportJob.status = 'in_progress';
    exportJob.progress = 0;

    try {
      // Query events
      const result = await this.query({
        ...exportJob.config.query,
        pageSize: 10000,
      });

      exportJob.progress = 50;

      // Simulate file generation
      await new Promise(resolve => setTimeout(resolve, 1000));

      exportJob.status = 'completed';
      exportJob.progress = 100;
      exportJob.completedAt = new Date().toISOString();
      exportJob.result = {
        recordCount: result.total,
        fileSize: result.total * 500, // Approximate bytes per record
        filePath: `/exports/audit-${exportJob.id}.${exportJob.config.format}`,
        downloadUrl: `/api/audit/exports/${exportJob.id}/download`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      exportJob.status = 'failed';
      exportJob.error = {
        code: 'EXPORT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getExport(exportId: string): Promise<AuditExport | null> {
    return this.exports.get(exportId) || null;
  }

  async listExports(): Promise<AuditExport[]> {
    return Array.from(this.exports.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  async createAlert(alert: Omit<AuditAlert, 'id' | 'metadata'>): Promise<AuditAlert> {
    const newAlert: AuditAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      metadata: {
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    this.alerts.set(newAlert.id, newAlert);
    return newAlert;
  }

  async updateAlert(alertId: string, updates: Partial<AuditAlert>): Promise<AuditAlert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    const updated = {
      ...alert,
      ...updates,
      id: alert.id,
      metadata: {
        ...alert.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    this.alerts.set(alertId, updated);
    return updated;
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    return this.alerts.delete(alertId);
  }

  async listAlerts(): Promise<AuditAlert[]> {
    return Array.from(this.alerts.values());
  }

  private async checkAlerts(event: AuditEvent): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      const matches = this.evaluateAlertConditions(alert, event);
      if (matches) {
        await this.triggerAlert(alert, event);
      }
    }
  }

  private evaluateAlertConditions(alert: AuditAlert, event: AuditEvent): boolean {
    return alert.conditions.every(condition => {
      switch (condition.type) {
        case 'event_type':
          if (condition.operator === 'eq') return event.eventType === condition.value;
          if (condition.operator === 'in') return (condition.value as string[]).includes(event.eventType);
          break;
        case 'severity':
          const severityOrder = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };
          const eventSeverity = severityOrder[event.severity];
          const conditionSeverity = severityOrder[condition.value as AuditSeverity];
          if (condition.operator === 'eq') return eventSeverity === conditionSeverity;
          if (condition.operator === 'gt') return eventSeverity > conditionSeverity;
          break;
        case 'outcome':
          if (condition.operator === 'eq') return event.outcome === condition.value;
          if (condition.operator === 'in') return (condition.value as string[]).includes(event.outcome);
          break;
      }
      return false;
    });
  }

  private async triggerAlert(alert: AuditAlert, event: AuditEvent): Promise<void> {
    const triggered: AuditAlertTriggered = {
      id: `triggered-${Date.now()}`,
      alertId: alert.id,
      triggeredAt: new Date().toISOString(),
      matchingEvents: [event.id],
      notificationsSent: [],
    };

    for (const action of alert.actions) {
      try {
        await this.sendAlertNotification(action, alert, event);
        triggered.notificationsSent.push({ channel: action.type, status: 'sent' });
      } catch (error) {
        triggered.notificationsSent.push({
          channel: action.type,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.triggeredAlerts.push(triggered);
  }

  private async sendAlertNotification(
    action: AuditAlert['actions'][0],
    alert: AuditAlert,
    event: AuditEvent
  ): Promise<void> {
    // In production, implement actual notification sending
    console.log(`Alert triggered: ${alert.name} for event ${event.id}`);
  }

  // ============================================================================
  // Compliance Reports
  // ============================================================================

  async generateComplianceReport(
    type: ComplianceReportType,
    framework: ComplianceFramework,
    startDate: string,
    endDate: string
  ): Promise<ComplianceReport> {
    const events = await this.query({
      startTime: startDate,
      endTime: endDate,
      pageSize: 10000,
    });

    const report: ComplianceReport = {
      id: `report-${Date.now()}`,
      type,
      framework,
      period: { start: startDate, end: endDate },
      status: 'completed',
      summary: this.generateReportSummary(events.items),
      sections: this.generateReportSections(type, events.items),
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
        version: '1.0',
      },
    };

    return report;
  }

  private generateReportSummary(events: AuditEvent[]): ComplianceReport['summary'] {
    const uniqueUsers = new Set(events.map(e => e.actor.id)).size;
    const uniqueResources = new Set(events.map(e => e.target.id)).size;
    const securityIncidents = events.filter(e =>
      e.category === 'security' || e.severity === 'critical' || e.severity === 'high'
    ).length;
    const policyViolations = events.filter(e =>
      e.eventType.includes('denied') || e.outcome === 'denied'
    ).length;

    return {
      totalEvents: events.length,
      uniqueUsers,
      uniqueResources,
      securityIncidents,
      policyViolations,
      highlights: [
        `${events.length} total audit events recorded`,
        `${uniqueUsers} unique users performed actions`,
        `${securityIncidents} security-related events`,
        `${policyViolations} access denied events`,
      ],
    };
  }

  private generateReportSections(
    type: ComplianceReportType,
    events: AuditEvent[]
  ): ComplianceReport['sections'] {
    const sections: ComplianceReport['sections'] = [];

    switch (type) {
      case 'access_review':
        sections.push({
          title: 'Access Grants and Revocations',
          description: 'Summary of permission changes during the period',
          findings: this.extractAccessFindings(events),
        });
        break;
      case 'security_incidents':
        sections.push({
          title: 'Security Events',
          description: 'High and critical severity events',
          findings: this.extractSecurityFindings(events),
        });
        break;
      case 'activity_summary':
        sections.push({
          title: 'User Activity',
          description: 'Overview of user actions',
          findings: [],
          charts: [
            {
              type: 'bar',
              title: 'Events by Category',
              data: this.aggregateByField(events, 'category'),
            },
          ],
        });
        break;
    }

    return sections;
  }

  private extractAccessFindings(events: AuditEvent[]): ComplianceReport['sections'][0]['findings'] {
    const accessEvents = events.filter(e => e.category === 'authorization');
    return accessEvents.slice(0, 10).map(e => ({
      id: e.id,
      severity: e.severity,
      title: e.action,
      description: e.details.description,
      evidence: [e.id],
      status: 'acknowledged' as const,
    }));
  }

  private extractSecurityFindings(events: AuditEvent[]): ComplianceReport['sections'][0]['findings'] {
    const securityEvents = events.filter(e =>
      e.severity === 'critical' || e.severity === 'high'
    );
    return securityEvents.slice(0, 10).map(e => ({
      id: e.id,
      severity: e.severity,
      title: `${e.eventType}: ${e.action}`,
      description: e.details.description,
      recommendation: 'Review and investigate this event',
      evidence: [e.id],
      status: 'open' as const,
    }));
  }

  private aggregateByField(events: AuditEvent[], field: keyof AuditEvent): any[] {
    const counts: Record<string, number> = {};
    for (const event of events) {
      const value = String(event[field]);
      counts[value] = (counts[value] || 0) + 1;
    }
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateCorrelationId(): string {
    return `cor-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private categorizeEvent(eventType: AuditEventType): AuditCategory {
    if (eventType.startsWith('auth.')) return 'authentication';
    if (eventType.startsWith('authz.')) return 'authorization';
    if (eventType.startsWith('resource.')) return 'resource';
    if (eventType.startsWith('user.')) return 'user_management';
    if (eventType.startsWith('config.')) return 'configuration';
    if (eventType.startsWith('action.')) return 'action';
    if (eventType.startsWith('template.')) return 'template';
    if (eventType.startsWith('system.')) return 'system';
    return 'system';
  }

  private determineSeverity(eventType: AuditEventType, outcome: AuditOutcome): AuditSeverity {
    // Critical events
    if (eventType === 'auth.login_failed' && outcome === 'failure') return 'medium';
    if (eventType.includes('deleted') && outcome === 'success') return 'medium';
    if (eventType === 'authz.permission_denied') return 'low';
    if (outcome === 'error') return 'high';

    // High severity events
    if (eventType.includes('role_assigned') || eventType.includes('role_revoked')) return 'medium';
    if (eventType.includes('api_key')) return 'medium';
    if (eventType.includes('policy')) return 'medium';

    return 'info';
  }

  private generateDescription(
    eventType: AuditEventType,
    actor: AuditActor,
    target: AuditTarget,
    action: string
  ): string {
    const actorName = actor.displayName || actor.email || actor.id;
    const targetName = target.name || target.id;

    return `${actorName} performed ${action} on ${target.type} ${targetName}`;
  }

  // ============================================================================
  // Sample Data
  // ============================================================================

  private initializeSampleData(): void {
    const sampleEvents: Array<{
      eventType: AuditEventType;
      actor: Partial<AuditActor>;
      target: Partial<AuditTarget>;
      action: string;
      outcome: AuditOutcome;
    }> = [
      {
        eventType: 'auth.login',
        actor: { type: 'user', id: 'user-1', displayName: 'Admin User', email: 'admin@company.com' },
        target: { type: 'system', id: 'auth' },
        action: 'User logged in',
        outcome: 'success',
      },
      {
        eventType: 'resource.created',
        actor: { type: 'user', id: 'user-2', displayName: 'Jane Developer' },
        target: { type: 'entity', id: 'svc-payment', name: 'Payment Service', kind: 'Component' },
        action: 'Created component',
        outcome: 'success',
      },
      {
        eventType: 'authz.role_assigned',
        actor: { type: 'user', id: 'user-1', displayName: 'Admin User' },
        target: { type: 'user', id: 'user-3', name: 'Bob Viewer' },
        action: 'Assigned viewer role',
        outcome: 'success',
      },
      {
        eventType: 'template.executed',
        actor: { type: 'user', id: 'user-2', displayName: 'Jane Developer' },
        target: { type: 'template', id: 'tmpl-nodejs', name: 'Node.js Service Template' },
        action: 'Executed template',
        outcome: 'success',
      },
      {
        eventType: 'action.executed',
        actor: { type: 'user', id: 'user-2', displayName: 'Jane Developer' },
        target: { type: 'entity', id: 'svc-api', name: 'API Gateway' },
        action: 'Deployed to production',
        outcome: 'success',
      },
    ];

    sampleEvents.forEach((event, index) => {
      const timestamp = new Date(Date.now() - index * 3600000).toISOString();
      this.events.push({
        id: `evt-sample-${index}`,
        timestamp,
        eventType: event.eventType,
        category: this.categorizeEvent(event.eventType),
        severity: this.determineSeverity(event.eventType, event.outcome),
        actor: {
          type: event.actor.type || 'user',
          id: event.actor.id || 'unknown',
          displayName: event.actor.displayName,
          email: event.actor.email,
        },
        target: {
          type: event.target.type || 'system',
          id: event.target.id || 'unknown',
          name: event.target.name,
          kind: event.target.kind,
        },
        action: event.action,
        outcome: event.outcome,
        details: {
          description: `${event.actor.displayName || 'User'} ${event.action.toLowerCase()}`,
        },
        metadata: {
          correlationId: `cor-sample-${index}`,
          environment: 'production',
          version: '1.0.0',
          source: 'sample',
          retention: { policy: 'standard' },
        },
      });
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let auditServiceInstance: AuditService | null = null;

export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new AuditService();
  }
  return auditServiceInstance;
}
