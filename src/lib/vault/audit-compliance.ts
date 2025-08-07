/**
 * Vault Audit Logging and Compliance System
 * Provides comprehensive audit logging, compliance reporting, and security monitoring
 */

import { EventEmitter } from 'events';
import { VaultApi } from './vault-client';
import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: 'auth' | 'request' | 'response' | 'error' | 'policy' | 'secret';
  operation: string;
  path: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    groups?: string[];
    policies?: string[];
  };
  client?: {
    ip: string;
    userAgent?: string;
    tokenId?: string;
  };
  request?: {
    method: string;
    headers?: Record<string, string>;
    data?: any;
  };
  response?: {
    statusCode: number;
    data?: any;
    warnings?: string[];
    errors?: string[];
  };
  metadata: {
    namespace?: string;
    mount?: string;
    policy?: string;
    ttl?: number;
    renewable?: boolean;
  };
  risk: 'low' | 'medium' | 'high' | 'critical';
  compliance?: {
    regulation: string[];
    violation?: boolean;
    reason?: string;
  };
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  regulation: string; // GDPR, SOX, PCI-DSS, etc.
  enabled: boolean;
  conditions: {
    paths?: string[];
    operations?: string[];
    users?: string[];
    policies?: string[];
  };
  actions: {
    alert: boolean;
    block: boolean;
    log: boolean;
    notify?: string[];
  };
  severity: 'info' | 'warning' | 'critical';
}

export interface ComplianceReport {
  id: string;
  period: {
    start: Date;
    end: Date;
  };
  regulation: string;
  summary: {
    totalEvents: number;
    violations: number;
    warnings: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  sections: {
    authentication: ComplianceSection;
    authorization: ComplianceSection;
    secretAccess: ComplianceSection;
    policyChanges: ComplianceSection;
    dataRetention: ComplianceSection;
  };
  recommendations: string[];
  generatedAt: Date;
}

export interface ComplianceSection {
  title: string;
  passed: number;
  failed: number;
  warnings: number;
  details: {
    requirement: string;
    status: 'pass' | 'fail' | 'warning';
    evidence: string[];
    remediation?: string;
  }[];
}

export interface AuditConfiguration {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  destinations: {
    file?: {
      path: string;
      maxSize: number;
      maxFiles: number;
      compress: boolean;
    };
    elasticsearch?: {
      host: string;
      index: string;
      apiKey?: string;
    };
    syslog?: {
      host: string;
      port: number;
      protocol: 'udp' | 'tcp';
    };
    webhook?: {
      url: string;
      headers: Record<string, string>;
      timeout: number;
    };
  };
  retention: {
    days: number;
    archivePath?: string;
  };
  realtime: boolean;
  batchSize: number;
  flushInterval: number; // milliseconds
}

/**
 * Comprehensive audit and compliance system for Vault
 */
export class VaultAuditCompliance extends EventEmitter {
  private config: AuditConfiguration;
  private vaultApi: VaultApi;
  private complianceRules: Map<string, ComplianceRule> = new Map();
  private auditBuffer: AuditEvent[] = [];
  private fileStreams: Map<string, WriteStream> = new Map();
  private flushTimer?: NodeJS.Timeout;
  private metricsCollector: Map<string, number> = new Map();

  constructor(config: AuditConfiguration, vaultApi: VaultApi) {
    super();
    this.config = config;
    this.vaultApi = vaultApi;
    this.initializeAuditSources();
    this.loadComplianceRules();
    this.startPeriodicFlush();
  }

  /**
   * Initialize audit event sources from Vault
   */
  private async initializeAuditSources(): Promise<void> {
    try {
      // Enable file audit backend
      await this.vaultApi.enableAuditBackend('file', {
        file_path: '/vault/audit/audit.log',
        log_raw: false,
        hmac_accessor: true,
        mode: '0600',
        format: 'json'
      });

      // Enable syslog audit backend for real-time monitoring
      if (this.config.destinations.syslog) {
        await this.vaultApi.enableAuditBackend('syslog', {
          facility: 'local7',
          tag: 'vault-audit'
        });
      }

      this.emit('audit_sources_initialized');
    } catch (error) {
      this.emit('audit_initialization_failed', error);
      console.error('Failed to initialize audit sources:', error);
    }
  }

  /**
   * Load compliance rules for different regulations
   */
  private loadComplianceRules(): void {
    // GDPR compliance rules
    this.addComplianceRule({
      id: 'gdpr-data-access',
      name: 'GDPR Data Access Logging',
      description: 'Log all access to personal data paths',
      regulation: 'GDPR',
      enabled: true,
      conditions: {
        paths: ['/secret/data/pii/*', '/secret/data/personal/*', '/secret/data/users/*']
      },
      actions: {
        alert: true,
        block: false,
        log: true,
        notify: ['privacy-officer@company.com']
      },
      severity: 'info'
    });

    // SOX compliance rules
    this.addComplianceRule({
      id: 'sox-financial-data',
      name: 'SOX Financial Data Protection',
      description: 'Monitor access to financial systems and data',
      regulation: 'SOX',
      enabled: true,
      conditions: {
        paths: ['/secret/data/financial/*', '/database/creds/finance*']
      },
      actions: {
        alert: true,
        block: false,
        log: true,
        notify: ['compliance@company.com']
      },
      severity: 'warning'
    });

    // PCI-DSS compliance rules
    this.addComplianceRule({
      id: 'pci-card-data',
      name: 'PCI-DSS Card Data Access',
      description: 'Monitor access to payment card data',
      regulation: 'PCI-DSS',
      enabled: true,
      conditions: {
        paths: ['/secret/data/payments/*', '/secret/data/cards/*']
      },
      actions: {
        alert: true,
        block: false,
        log: true,
        notify: ['security@company.com']
      },
      severity: 'critical'
    });

    // Privileged access monitoring
    this.addComplianceRule({
      id: 'privileged-access',
      name: 'Privileged Access Monitoring',
      description: 'Monitor all administrative operations',
      regulation: 'General',
      enabled: true,
      conditions: {
        operations: ['create', 'update', 'delete'],
        policies: ['admin-policy', 'root']
      },
      actions: {
        alert: true,
        block: false,
        log: true,
        notify: ['security@company.com']
      },
      severity: 'warning'
    });
  }

  /**
   * Process audit event and check compliance
   */
  async processAuditEvent(rawEvent: any): Promise<void> {
    try {
      const auditEvent = this.parseAuditEvent(rawEvent);
      
      // Apply compliance rules
      const violations = this.checkCompliance(auditEvent);
      if (violations.length > 0) {
        auditEvent.compliance = {
          regulation: violations.map(v => v.regulation),
          violation: true,
          reason: violations.map(v => v.reason).join('; ')
        };
      }

      // Assess risk level
      auditEvent.risk = this.assessRisk(auditEvent);

      // Add to buffer
      this.auditBuffer.push(auditEvent);

      // Update metrics
      this.updateMetrics(auditEvent);

      // Handle real-time processing
      if (this.config.realtime) {
        await this.handleRealtimeEvent(auditEvent);
      }

      // Flush if buffer is full
      if (this.auditBuffer.length >= this.config.batchSize) {
        await this.flushAuditBuffer();
      }

      this.emit('audit_event_processed', auditEvent);
      
    } catch (error) {
      this.emit('audit_processing_failed', { error, rawEvent });
      console.error('Failed to process audit event:', error);
    }
  }

  /**
   * Parse raw Vault audit event into structured format
   */
  private parseAuditEvent(rawEvent: any): AuditEvent {
    const event = rawEvent.type === 'response' ? rawEvent : rawEvent.request || rawEvent;
    
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(event.time),
      type: this.categorizeEventType(event),
      operation: event.operation || 'unknown',
      path: event.path || '',
      user: this.extractUserInfo(event),
      client: this.extractClientInfo(event),
      request: event.type === 'request' ? {
        method: event.operation,
        headers: event.request?.headers,
        data: this.sanitizeData(event.request?.data)
      } : undefined,
      response: event.type === 'response' ? {
        statusCode: event.response?.status || 200,
        data: this.sanitizeData(event.response?.data),
        warnings: event.response?.warnings,
        errors: event.response?.errors
      } : undefined,
      metadata: {
        namespace: event.namespace,
        mount: event.mount,
        policy: event.policy,
        ttl: event.ttl,
        renewable: event.renewable
      },
      risk: 'low' // Will be assessed later
    };
  }

  /**
   * Check compliance rules against audit event
   */
  private checkCompliance(event: AuditEvent): Array<{ regulation: string; reason: string }> {
    const violations: Array<{ regulation: string; reason: string }> = [];

    for (const rule of this.complianceRules.values()) {
      if (!rule.enabled) continue;

      let matches = false;
      let reason = '';

      // Check path conditions
      if (rule.conditions.paths) {
        const pathMatches = rule.conditions.paths.some(pattern => {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(event.path);
        });
        if (pathMatches) {
          matches = true;
          reason += `Path ${event.path} matches restricted pattern. `;
        }
      }

      // Check operation conditions
      if (rule.conditions.operations) {
        if (rule.conditions.operations.includes(event.operation)) {
          matches = true;
          reason += `Operation ${event.operation} requires compliance monitoring. `;
        }
      }

      // Check user conditions
      if (rule.conditions.users && event.user) {
        if (rule.conditions.users.includes(event.user.id)) {
          matches = true;
          reason += `User ${event.user.id} requires special monitoring. `;
        }
      }

      // Check policy conditions
      if (rule.conditions.policies && event.user?.policies) {
        const policyMatch = rule.conditions.policies.some(policy =>
          event.user!.policies!.includes(policy)
        );
        if (policyMatch) {
          matches = true;
          reason += `User has privileged policy access. `;
        }
      }

      if (matches) {
        violations.push({
          regulation: rule.regulation,
          reason: reason.trim()
        });

        // Execute rule actions
        this.executeRuleActions(rule, event);
      }
    }

    return violations;
  }

  /**
   * Assess risk level based on event characteristics
   */
  private assessRisk(event: AuditEvent): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // High-risk operations
    const highRiskOps = ['delete', 'destroy', 'revoke', 'unseal'];
    if (highRiskOps.includes(event.operation)) {
      riskScore += 3;
    }

    // Privileged paths
    const privilegedPaths = ['/sys/', '/auth/', '/secret/data/admin'];
    if (privilegedPaths.some(path => event.path.startsWith(path))) {
      riskScore += 2;
    }

    // Failed operations
    if (event.response?.statusCode && event.response.statusCode >= 400) {
      riskScore += 2;
    }

    // Compliance violations
    if (event.compliance?.violation) {
      riskScore += 3;
    }

    // Administrative users
    if (event.user?.policies?.includes('admin-policy') || event.user?.policies?.includes('root')) {
      riskScore += 1;
    }

    // Off-hours access
    const hour = event.timestamp.getHours();
    if (hour < 6 || hour > 20) {
      riskScore += 1;
    }

    // Determine risk level
    if (riskScore >= 7) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Generate compliance report for specified regulation and period
   */
  async generateComplianceReport(
    regulation: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const reportId = `${regulation}-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}`;
    
    // Collect relevant audit events
    const events = await this.getAuditEventsForPeriod(startDate, endDate, regulation);
    
    const report: ComplianceReport = {
      id: reportId,
      period: { start: startDate, end: endDate },
      regulation,
      summary: {
        totalEvents: events.length,
        violations: events.filter(e => e.compliance?.violation).length,
        warnings: events.filter(e => e.risk === 'medium' || e.risk === 'high').length,
        riskLevel: this.calculateOverallRisk(events)
      },
      sections: {
        authentication: this.generateAuthenticationSection(events),
        authorization: this.generateAuthorizationSection(events),
        secretAccess: this.generateSecretAccessSection(events),
        policyChanges: this.generatePolicyChangesSection(events),
        dataRetention: this.generateDataRetentionSection(events)
      },
      recommendations: this.generateRecommendations(events, regulation),
      generatedAt: new Date()
    };

    this.emit('compliance_report_generated', report);
    return report;
  }

  /**
   * Add or update compliance rule
   */
  addComplianceRule(rule: ComplianceRule): void {
    this.complianceRules.set(rule.id, rule);
    this.emit('compliance_rule_updated', rule);
  }

  /**
   * Get current audit metrics
   */
  getAuditMetrics(): Record<string, number> {
    return Object.fromEntries(this.metricsCollector);
  }

  /**
   * Export audit logs for external analysis
   */
  async exportAuditLogs(
    format: 'json' | 'csv' | 'xml',
    startDate: Date,
    endDate: Date,
    filters?: {
      users?: string[];
      paths?: string[];
      operations?: string[];
      riskLevels?: string[];
    }
  ): Promise<string> {
    const events = await this.getAuditEventsForPeriod(startDate, endDate);
    
    let filteredEvents = events;
    
    if (filters) {
      filteredEvents = events.filter(event => {
        if (filters.users && event.user && !filters.users.includes(event.user.id)) {
          return false;
        }
        if (filters.paths && !filters.paths.some(path => event.path.includes(path))) {
          return false;
        }
        if (filters.operations && !filters.operations.includes(event.operation)) {
          return false;
        }
        if (filters.riskLevels && !filters.riskLevels.includes(event.risk)) {
          return false;
        }
        return true;
      });
    }

    switch (format) {
      case 'json':
        return JSON.stringify(filteredEvents, null, 2);
      case 'csv':
        return this.convertToCSV(filteredEvents);
      case 'xml':
        return this.convertToXML(filteredEvents);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private categorizeEventType(event: any): 'auth' | 'request' | 'response' | 'error' | 'policy' | 'secret' {
    if (event.type) return event.type;
    
    if (event.path?.startsWith('/auth/')) return 'auth';
    if (event.path?.startsWith('/sys/policies/')) return 'policy';
    if (event.path?.startsWith('/secret/') || event.path?.startsWith('/kv/')) return 'secret';
    if (event.error) return 'error';
    
    return 'request';
  }

  private extractUserInfo(event: any): AuditEvent['user'] {
    const auth = event.auth || {};
    return {
      id: auth.client_token || auth.accessor || 'unknown',
      name: auth.display_name,
      email: auth.metadata?.email,
      groups: auth.groups,
      policies: auth.policies
    };
  }

  private extractClientInfo(event: any): AuditEvent['client'] {
    return {
      ip: event.remote_address || event.client_ip || 'unknown',
      userAgent: event.headers?.['User-Agent'],
      tokenId: event.auth?.client_token
    };
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    const sanitized = JSON.parse(JSON.stringify(data));
    
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
      return obj;
    };

    return sanitizeObject(sanitized);
  }

  private executeRuleActions(rule: ComplianceRule, event: AuditEvent): void {
    if (rule.actions.alert) {
      this.emit('compliance_alert', { rule, event });
    }

    if (rule.actions.notify && rule.actions.notify.length > 0) {
      this.emit('compliance_notification', {
        rule,
        event,
        recipients: rule.actions.notify
      });
    }

    if (rule.actions.block) {
      this.emit('compliance_block_request', { rule, event });
    }
  }

  private async handleRealtimeEvent(event: AuditEvent): Promise<void> {
    // Send to configured destinations immediately
    await this.sendToDestinations([event]);

    // Emit real-time event
    this.emit('realtime_audit_event', event);

    // Handle high-risk events immediately
    if (event.risk === 'critical' || event.risk === 'high') {
      this.emit('high_risk_event', event);
    }
  }

  private updateMetrics(event: AuditEvent): void {
    // Update basic counters
    this.incrementMetric('total_events');
    this.incrementMetric(`events_by_type_${event.type}`);
    this.incrementMetric(`events_by_risk_${event.risk}`);
    this.incrementMetric(`events_by_operation_${event.operation}`);

    if (event.user) {
      this.incrementMetric(`events_by_user_${event.user.id}`);
    }

    if (event.compliance?.violation) {
      this.incrementMetric('compliance_violations');
    }

    if (event.response?.statusCode && event.response.statusCode >= 400) {
      this.incrementMetric('failed_operations');
    }
  }

  private incrementMetric(key: string): void {
    const current = this.metricsCollector.get(key) || 0;
    this.metricsCollector.set(key, current + 1);
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(async () => {
      if (this.auditBuffer.length > 0) {
        await this.flushAuditBuffer();
      }
    }, this.config.flushInterval);
  }

  private async flushAuditBuffer(): Promise<void> {
    if (this.auditBuffer.length === 0) return;

    try {
      const eventsToFlush = [...this.auditBuffer];
      this.auditBuffer.length = 0; // Clear buffer

      await this.sendToDestinations(eventsToFlush);
      this.emit('audit_buffer_flushed', { count: eventsToFlush.length });
      
    } catch (error) {
      this.emit('audit_flush_failed', error);
      console.error('Failed to flush audit buffer:', error);
    }
  }

  private async sendToDestinations(events: AuditEvent[]): Promise<void> {
    const promises: Promise<void>[] = [];

    // File destination
    if (this.config.destinations.file) {
      promises.push(this.writeToFile(events));
    }

    // Elasticsearch destination
    if (this.config.destinations.elasticsearch) {
      promises.push(this.sendToElasticsearch(events));
    }

    // Webhook destination
    if (this.config.destinations.webhook) {
      promises.push(this.sendToWebhook(events));
    }

    await Promise.allSettled(promises);
  }

  private async writeToFile(events: AuditEvent[]): Promise<void> {
    if (!this.config.destinations.file) return;

    const filePath = this.config.destinations.file.path;
    
    if (!this.fileStreams.has(filePath)) {
      this.fileStreams.set(filePath, createWriteStream(filePath, { flags: 'a' }));
    }

    const stream = this.fileStreams.get(filePath)!;
    
    for (const event of events) {
      stream.write(JSON.stringify(event) + '\n');
    }
  }

  private async sendToElasticsearch(events: AuditEvent[]): Promise<void> {
    // Placeholder for Elasticsearch implementation
    // In production, use official Elasticsearch client
    console.log(`Would send ${events.length} events to Elasticsearch`);
  }

  private async sendToWebhook(events: AuditEvent[]): Promise<void> {
    // Placeholder for webhook implementation
    console.log(`Would send ${events.length} events to webhook`);
  }

  private async getAuditEventsForPeriod(
    startDate: Date,
    endDate: Date,
    regulation?: string
  ): Promise<AuditEvent[]> {
    // Placeholder - in production, query from persistent storage
    return this.auditBuffer.filter(event => {
      const inPeriod = event.timestamp >= startDate && event.timestamp <= endDate;
      const matchesRegulation = !regulation || 
        (event.compliance?.regulation.includes(regulation));
      
      return inPeriod && matchesRegulation;
    });
  }

  private calculateOverallRisk(events: AuditEvent[]): 'low' | 'medium' | 'high' | 'critical' {
    if (events.length === 0) return 'low';
    
    const criticalCount = events.filter(e => e.risk === 'critical').length;
    const highCount = events.filter(e => e.risk === 'high').length;
    
    const criticalRatio = criticalCount / events.length;
    const highRatio = (criticalCount + highCount) / events.length;
    
    if (criticalRatio > 0.1) return 'critical';
    if (highRatio > 0.3) return 'high';
    if (highRatio > 0.1) return 'medium';
    return 'low';
  }

  // Placeholder methods for compliance report sections
  private generateAuthenticationSection(events: AuditEvent[]): ComplianceSection {
    const authEvents = events.filter(e => e.type === 'auth');
    return {
      title: 'Authentication Events',
      passed: authEvents.filter(e => e.response?.statusCode === 200).length,
      failed: authEvents.filter(e => e.response?.statusCode !== 200).length,
      warnings: 0,
      details: []
    };
  }

  private generateAuthorizationSection(events: AuditEvent[]): ComplianceSection {
    return {
      title: 'Authorization Events',
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  private generateSecretAccessSection(events: AuditEvent[]): ComplianceSection {
    const secretEvents = events.filter(e => e.type === 'secret');
    return {
      title: 'Secret Access Events',
      passed: secretEvents.length,
      failed: 0,
      warnings: secretEvents.filter(e => e.risk === 'high').length,
      details: []
    };
  }

  private generatePolicyChangesSection(events: AuditEvent[]): ComplianceSection {
    return {
      title: 'Policy Changes',
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  private generateDataRetentionSection(events: AuditEvent[]): ComplianceSection {
    return {
      title: 'Data Retention',
      passed: 1,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  private generateRecommendations(events: AuditEvent[], regulation: string): string[] {
    const recommendations: string[] = [];
    
    const highRiskEvents = events.filter(e => e.risk === 'high' || e.risk === 'critical');
    if (highRiskEvents.length > 0) {
      recommendations.push('Review high-risk operations and consider additional approval processes');
    }
    
    const violations = events.filter(e => e.compliance?.violation);
    if (violations.length > 0) {
      recommendations.push('Address compliance violations with additional training and controls');
    }
    
    return recommendations;
  }

  private convertToCSV(events: AuditEvent[]): string {
    // Placeholder CSV conversion
    const header = 'timestamp,type,operation,path,user,risk,compliance\n';
    const rows = events.map(event => 
      `${event.timestamp.toISOString()},${event.type},${event.operation},${event.path},${event.user?.id || ''},${event.risk},${event.compliance?.violation || false}`
    ).join('\n');
    
    return header + rows;
  }

  private convertToXML(events: AuditEvent[]): string {
    // Placeholder XML conversion
    return `<?xml version="1.0" encoding="UTF-8"?>\n<audit_events>\n${events.map(event => 
      `  <event id="${event.id}" timestamp="${event.timestamp.toISOString()}" risk="${event.risk}"/>`
    ).join('\n')}\n</audit_events>`;
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining events
    if (this.auditBuffer.length > 0) {
      this.flushAuditBuffer();
    }

    // Close file streams
    for (const stream of this.fileStreams.values()) {
      stream.end();
    }
    this.fileStreams.clear();

    this.removeAllListeners();
  }
}

/**
 * Factory function to create a configured audit and compliance system
 */
export function createVaultAuditCompliance(
  config: AuditConfiguration,
  vaultApi: VaultApi
): VaultAuditCompliance {
  return new VaultAuditCompliance(config, vaultApi);
}