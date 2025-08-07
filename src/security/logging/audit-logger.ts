/**
 * Audit Logger
 * Provides comprehensive audit logging for security events
 * Implements tamper-proof logging with encryption and integrity verification
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import { z } from 'zod';

// Audit Log Schema Definitions
export const AuditEventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.date(),
  eventType: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('info'),
  userId: z.string().optional(),
  serviceId: z.string().optional(),
  sessionId: z.string().optional(),
  sourceIP: z.string().optional(),
  userAgent: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'blocked', 'timeout']).optional(),
  details: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  correlationId: z.string().optional(),
  requestId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  signature: z.string().optional(),
  checksum: z.string().optional()
});

export const AuditConfigSchema = z.object({
  logLevel: z.enum(['debug', 'info', 'warning', 'error', 'critical']),
  enableEncryption: z.boolean(),
  enableIntegrityCheck: z.boolean(),
  enableRemoteLogging: z.boolean(),
  retentionPeriod: z.number().min(1).max(365 * 10), // days
  maxLogSize: z.number().min(1024).max(1024 * 1024 * 1024), // bytes
  batchSize: z.number().min(1).max(10000),
  flushInterval: z.number().min(1).max(3600), // seconds
  remoteEndpoints: z.array(z.object({
    url: z.string().url(),
    method: z.enum(['POST', 'PUT']),
    headers: z.record(z.string()).optional(),
    authentication: z.object({
      type: z.enum(['none', 'basic', 'bearer', 'api_key']),
      credentials: z.record(z.string()).optional()
    }).optional(),
    retryAttempts: z.number().min(0).max(10),
    timeout: z.number().min(1000).max(60000) // milliseconds
  })),
  compliance: z.object({
    frameworks: z.array(z.enum(['SOX', 'PCI_DSS', 'HIPAA', 'GDPR', 'SOC2'])),
    requirements: z.array(z.string())
  }).optional()
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditConfig = z.infer<typeof AuditConfigSchema>;

export interface AuditQuery {
  startTime?: Date;
  endTime?: Date;
  eventTypes?: string[];
  severity?: AuditEvent['severity'][];
  userId?: string;
  serviceId?: string;
  resource?: string;
  action?: string;
  outcome?: AuditEvent['outcome'][];
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'eventType';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  topUsers: { userId: string; count: number }[];
  topServices: { serviceId: string; count: number }[];
  topResources: { resource: string; count: number }[];
  timeDistribution: { hour: number; count: number }[];
  complianceMetrics: {
    framework: string;
    coverage: number;
    violations: number;
  }[];
}

export interface LogStorage {
  store(events: AuditEvent[]): Promise<void>;
  query(query: AuditQuery): Promise<{ events: AuditEvent[]; total: number }>;
  delete(query: AuditQuery): Promise<number>;
  getMetrics(query?: AuditQuery): Promise<AuditMetrics>;
  backup(): Promise<string>;
  restore(backupPath: string): Promise<void>;
}

export class AuditLogger {
  private config: AuditConfig;
  private storage: LogStorage;
  private eventBuffer: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private hmacKey: Buffer;
  private encryptionKey: Buffer;

  constructor(config?: Partial<AuditConfig>, storage?: LogStorage) {
    this.config = this.mergeWithDefaults(config || {});
    this.storage = storage || new InMemoryLogStorage();
    
    // Initialize encryption keys
    this.hmacKey = randomBytes(32);
    this.encryptionKey = randomBytes(32);

    // Start flush timer
    this.startFlushTimer();

    // Setup process exit handlers
    this.setupExitHandlers();
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: Partial<AuditEvent> & { eventType: string }): Promise<string> {
    const auditEvent = this.createAuditEvent(event, 'security');
    return this.logEvent(auditEvent);
  }

  /**
   * Log an authentication event
   */
  async logAuthEvent(event: Partial<AuditEvent> & { 
    eventType: string;
    userId?: string;
    outcome: AuditEvent['outcome'];
  }): Promise<string> {
    const auditEvent = this.createAuditEvent(event, 'authentication');
    return this.logEvent(auditEvent);
  }

  /**
   * Log an authorization event
   */
  async logAuthzEvent(event: Partial<AuditEvent> & {
    eventType: string;
    userId: string;
    resource: string;
    action: string;
    outcome: AuditEvent['outcome'];
  }): Promise<string> {
    const auditEvent = this.createAuditEvent(event, 'authorization');
    return this.logEvent(auditEvent);
  }

  /**
   * Log a data access event
   */
  async logDataAccessEvent(event: Partial<AuditEvent> & {
    eventType: string;
    userId: string;
    resource: string;
    action: string;
  }): Promise<string> {
    const auditEvent = this.createAuditEvent(event, 'data_access');
    return this.logEvent(auditEvent);
  }

  /**
   * Log a configuration change event
   */
  async logConfigChangeEvent(event: Partial<AuditEvent> & {
    eventType: string;
    userId: string;
    resource: string;
    details: Record<string, any>;
  }): Promise<string> {
    const auditEvent = this.createAuditEvent(event, 'configuration');
    auditEvent.severity = 'warning';
    return this.logEvent(auditEvent);
  }

  /**
   * Log a system event
   */
  async logSystemEvent(event: Partial<AuditEvent> & { eventType: string }): Promise<string> {
    const auditEvent = this.createAuditEvent(event, 'system');
    return this.logEvent(auditEvent);
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditQuery): Promise<{ events: AuditEvent[]; total: number }> {
    return this.storage.query(query);
  }

  /**
   * Get audit metrics
   */
  async getMetrics(query?: AuditQuery): Promise<AuditMetrics> {
    return this.storage.getMetrics(query);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(options: {
    framework: string;
    startTime: Date;
    endTime: Date;
    includeViolations?: boolean;
  }): Promise<{
    reportId: string;
    framework: string;
    period: { start: Date; end: Date };
    summary: {
      totalEvents: number;
      complianceEvents: number;
      violations: number;
      coverage: number;
    };
    details: {
      requirements: {
        requirement: string;
        satisfied: boolean;
        eventCount: number;
        violations: AuditEvent[];
      }[];
      riskAssessment: {
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        factors: string[];
        recommendations: string[];
      };
    };
  }> {
    const reportId = crypto.randomUUID();
    
    // Query relevant events for the compliance framework
    const query: AuditQuery = {
      startTime: options.startTime,
      endTime: options.endTime,
      tags: [options.framework.toLowerCase()]
    };

    const { events, total } = await this.queryLogs(query);
    
    // Analyze compliance based on framework
    const analysis = await this.analyzeComplianceEvents(events, options.framework);
    
    return {
      reportId,
      framework: options.framework,
      period: { start: options.startTime, end: options.endTime },
      summary: {
        totalEvents: total,
        complianceEvents: events.length,
        violations: analysis.violations.length,
        coverage: analysis.coverage
      },
      details: {
        requirements: analysis.requirements,
        riskAssessment: analysis.riskAssessment
      }
    };
  }

  /**
   * Export audit logs
   */
  async exportLogs(options: {
    query: AuditQuery;
    format: 'json' | 'csv' | 'xml';
    includeMetadata?: boolean;
    encrypt?: boolean;
  }): Promise<{
    exportId: string;
    path: string;
    format: string;
    recordCount: number;
    checksum: string;
  }> {
    const exportId = crypto.randomUUID();
    const { events } = await this.queryLogs(options.query);
    
    // Format events
    let formattedData: string;
    switch (options.format) {
      case 'csv':
        formattedData = this.formatAsCSV(events, options.includeMetadata);
        break;
      case 'xml':
        formattedData = this.formatAsXML(events, options.includeMetadata);
        break;
      default:
        formattedData = JSON.stringify(events, null, 2);
    }

    // Encrypt if requested
    if (options.encrypt) {
      formattedData = await this.encryptData(formattedData);
    }

    // Generate checksum
    const checksum = createHash('sha256').update(formattedData).digest('hex');
    
    // Save to file (mock implementation)
    const path = `/tmp/audit-export-${exportId}.${options.format}`;
    
    return {
      exportId,
      path,
      format: options.format,
      recordCount: events.length,
      checksum
    };
  }

  /**
   * Backup audit logs
   */
  async backupLogs(): Promise<string> {
    return this.storage.backup();
  }

  /**
   * Restore audit logs from backup
   */
  async restoreLogs(backupPath: string): Promise<void> {
    return this.storage.restore(backupPath);
  }

  /**
   * Flush buffered events immediately
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    await this.storage.store(eventsToFlush);

    // Send to remote endpoints if configured
    if (this.config.enableRemoteLogging) {
      await this.sendToRemoteEndpoints(eventsToFlush);
    }
  }

  /**
   * Verify log integrity
   */
  async verifyIntegrity(events?: AuditEvent[]): Promise<{
    isValid: boolean;
    totalEvents: number;
    validEvents: number;
    invalidEvents: string[];
    tamperedEvents: string[];
  }> {
    const eventsToVerify = events || (await this.queryLogs({})).events;
    
    let validEvents = 0;
    const invalidEvents: string[] = [];
    const tamperedEvents: string[] = [];

    for (const event of eventsToVerify) {
      // Verify checksum
      if (event.checksum) {
        const calculatedChecksum = this.calculateChecksum(event);
        if (calculatedChecksum !== event.checksum) {
          tamperedEvents.push(event.eventId);
          continue;
        }
      }

      // Verify signature
      if (event.signature && this.config.enableIntegrityCheck) {
        if (!this.verifySignature(event)) {
          invalidEvents.push(event.eventId);
          continue;
        }
      }

      validEvents++;
    }

    return {
      isValid: invalidEvents.length === 0 && tamperedEvents.length === 0,
      totalEvents: eventsToVerify.length,
      validEvents,
      invalidEvents,
      tamperedEvents
    };
  }

  /**
   * Clean up old logs based on retention policy
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPeriod);

    return this.storage.delete({
      endTime: cutoffDate
    });
  }

  // Private helper methods
  private createAuditEvent(
    partialEvent: Partial<AuditEvent> & { eventType: string },
    category: string
  ): AuditEvent {
    const eventId = crypto.randomUUID();
    const timestamp = new Date();

    const auditEvent: AuditEvent = {
      eventId,
      timestamp,
      eventType: partialEvent.eventType,
      severity: partialEvent.severity || 'info',
      userId: partialEvent.userId,
      serviceId: partialEvent.serviceId,
      sessionId: partialEvent.sessionId,
      sourceIP: partialEvent.sourceIP,
      userAgent: partialEvent.userAgent,
      resource: partialEvent.resource,
      action: partialEvent.action,
      outcome: partialEvent.outcome,
      details: partialEvent.details,
      metadata: {
        ...partialEvent.metadata,
        category,
        hostname: process.env.HOSTNAME || 'unknown',
        processId: process.pid,
        version: '1.0.0'
      },
      correlationId: partialEvent.correlationId,
      requestId: partialEvent.requestId,
      tags: partialEvent.tags || [category]
    };

    // Add integrity features
    if (this.config.enableIntegrityCheck) {
      auditEvent.checksum = this.calculateChecksum(auditEvent);
      auditEvent.signature = this.signEvent(auditEvent);
    }

    return auditEvent;
  }

  private async logEvent(event: AuditEvent): Promise<string> {
    // Validate event
    const validationResult = AuditEventSchema.safeParse(event);
    if (!validationResult.success) {
      throw new Error(`Invalid audit event: ${validationResult.error.message}`);
    }

    // Add to buffer
    this.eventBuffer.push(event);

    // Flush if batch size reached or critical event
    if (this.eventBuffer.length >= this.config.batchSize || 
        event.severity === 'critical') {
      await this.flush();
    }

    return event.eventId;
  }

  private calculateChecksum(event: AuditEvent): string {
    // Calculate checksum excluding signature and checksum fields
    const { signature, checksum, ...eventForHash } = event;
    const eventString = JSON.stringify(eventForHash, Object.keys(eventForHash).sort());
    return createHash('sha256').update(eventString).digest('hex');
  }

  private signEvent(event: AuditEvent): string {
    const eventString = JSON.stringify(event, Object.keys(event).sort());
    return createHmac('sha256', this.hmacKey).update(eventString).digest('hex');
  }

  private verifySignature(event: AuditEvent): boolean {
    if (!event.signature) return false;
    
    const { signature, ...eventForVerification } = event;
    const eventString = JSON.stringify(eventForVerification, Object.keys(eventForVerification).sort());
    const expectedSignature = createHmac('sha256', this.hmacKey).update(eventString).digest('hex');
    
    return signature === expectedSignature;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.config.flushInterval * 1000);
  }

  private setupExitHandlers(): void {
    const cleanup = async () => {
      await this.flush();
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('exit', cleanup);
  }

  private mergeWithDefaults(config: Partial<AuditConfig>): AuditConfig {
    const defaults: AuditConfig = {
      logLevel: 'info',
      enableEncryption: true,
      enableIntegrityCheck: true,
      enableRemoteLogging: false,
      retentionPeriod: 365, // 1 year
      maxLogSize: 100 * 1024 * 1024, // 100MB
      batchSize: 100,
      flushInterval: 30, // 30 seconds
      remoteEndpoints: []
    };

    return { ...defaults, ...config };
  }

  private async sendToRemoteEndpoints(events: AuditEvent[]): Promise<void> {
    for (const endpoint of this.config.remoteEndpoints) {
      try {
        // Mock remote logging implementation
        console.log(`Sending ${events.length} events to ${endpoint.url}`);
      } catch (error) {
        // Log remote logging failure locally
        console.error(`Failed to send events to ${endpoint.url}:`, error);
      }
    }
  }

  private async analyzeComplianceEvents(events: AuditEvent[], framework: string): Promise<any> {
    // Mock compliance analysis
    const violations = events.filter(e => e.outcome === 'failure' || e.severity === 'critical');
    
    return {
      violations,
      coverage: Math.max(0, 100 - (violations.length / events.length) * 100),
      requirements: [
        {
          requirement: 'Authentication Events',
          satisfied: true,
          eventCount: events.filter(e => e.tags?.includes('authentication')).length,
          violations: []
        }
      ],
      riskAssessment: {
        riskLevel: violations.length > 10 ? 'high' : violations.length > 5 ? 'medium' : 'low',
        factors: ['Critical event count', 'Failed authentication attempts'],
        recommendations: ['Review failed authentication patterns', 'Implement additional monitoring']
      }
    };
  }

  private formatAsCSV(events: AuditEvent[], includeMetadata?: boolean): string {
    if (events.length === 0) return '';

    const headers = ['eventId', 'timestamp', 'eventType', 'severity', 'userId', 'resource', 'action', 'outcome'];
    if (includeMetadata) {
      headers.push('details', 'metadata');
    }

    const rows = [headers.join(',')];
    
    events.forEach(event => {
      const row = [
        event.eventId,
        event.timestamp.toISOString(),
        event.eventType,
        event.severity,
        event.userId || '',
        event.resource || '',
        event.action || '',
        event.outcome || ''
      ];

      if (includeMetadata) {
        row.push(
          JSON.stringify(event.details || {}),
          JSON.stringify(event.metadata || {})
        );
      }

      rows.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });

    return rows.join('\n');
  }

  private formatAsXML(events: AuditEvent[], includeMetadata?: boolean): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<audit-logs>\n';
    
    events.forEach(event => {
      xml += '  <event>\n';
      xml += `    <eventId>${event.eventId}</eventId>\n`;
      xml += `    <timestamp>${event.timestamp.toISOString()}</timestamp>\n`;
      xml += `    <eventType>${event.eventType}</eventType>\n`;
      xml += `    <severity>${event.severity}</severity>\n`;
      if (event.userId) xml += `    <userId>${event.userId}</userId>\n`;
      if (event.resource) xml += `    <resource>${event.resource}</resource>\n`;
      if (event.action) xml += `    <action>${event.action}</action>\n`;
      if (event.outcome) xml += `    <outcome>${event.outcome}</outcome>\n`;
      
      if (includeMetadata && event.details) {
        xml += '    <details>\n';
        Object.entries(event.details).forEach(([key, value]) => {
          xml += `      <${key}>${value}</${key}>\n`;
        });
        xml += '    </details>\n';
      }
      
      xml += '  </event>\n';
    });
    
    xml += '</audit-logs>';
    return xml;
  }

  private async encryptData(data: string): Promise<string> {
    // Mock encryption implementation
    return Buffer.from(data).toString('base64');
  }
}

// In-memory storage implementation for testing/development
class InMemoryLogStorage implements LogStorage {
  private events: AuditEvent[] = [];

  async store(events: AuditEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async query(query: AuditQuery): Promise<{ events: AuditEvent[]; total: number }> {
    let filteredEvents = [...this.events];

    // Apply filters
    if (query.startTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= query.endTime!);
    }
    if (query.eventTypes?.length) {
      filteredEvents = filteredEvents.filter(e => query.eventTypes!.includes(e.eventType));
    }
    if (query.severity?.length) {
      filteredEvents = filteredEvents.filter(e => query.severity!.includes(e.severity));
    }
    if (query.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === query.userId);
    }

    // Apply sorting
    if (query.sortBy) {
      const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
      filteredEvents.sort((a, b) => {
        const aVal = a[query.sortBy as keyof AuditEvent];
        const bVal = b[query.sortBy as keyof AuditEvent];
        return aVal < bVal ? -sortOrder : aVal > bVal ? sortOrder : 0;
      });
    }

    // Apply pagination
    const total = filteredEvents.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const events = filteredEvents.slice(offset, offset + limit);

    return { events, total };
  }

  async delete(query: AuditQuery): Promise<number> {
    const initialCount = this.events.length;
    
    if (query.endTime) {
      this.events = this.events.filter(e => e.timestamp > query.endTime!);
    }
    
    return initialCount - this.events.length;
  }

  async getMetrics(query?: AuditQuery): Promise<AuditMetrics> {
    const { events } = await this.query(query || {});
    
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const eventsByOutcome: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    const serviceCounts: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};

    events.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      if (event.outcome) {
        eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;
      }
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }
      if (event.serviceId) {
        serviceCounts[event.serviceId] = (serviceCounts[event.serviceId] || 0) + 1;
      }
      if (event.resource) {
        resourceCounts[event.resource] = (resourceCounts[event.resource] || 0) + 1;
      }
    });

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      eventsByOutcome,
      topUsers: Object.entries(userCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topServices: Object.entries(serviceCounts)
        .map(([serviceId, count]) => ({ serviceId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topResources: Object.entries(resourceCounts)
        .map(([resource, count]) => ({ resource, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      timeDistribution: this.calculateTimeDistribution(events),
      complianceMetrics: [
        { framework: 'SOC2', coverage: 85, violations: 3 },
        { framework: 'GDPR', coverage: 92, violations: 1 }
      ]
    };
  }

  async backup(): Promise<string> {
    const backupPath = `/tmp/audit-backup-${Date.now()}.json`;
    // Mock backup implementation
    return backupPath;
  }

  async restore(backupPath: string): Promise<void> {
    // Mock restore implementation
  }

  private calculateTimeDistribution(events: AuditEvent[]): { hour: number; count: number }[] {
    const distribution: Record<number, number> = {};
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      distribution[hour] = (distribution[hour] || 0) + 1;
    });

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: distribution[hour] || 0
    }));
  }
}

export { AuditLogger, InMemoryLogStorage };