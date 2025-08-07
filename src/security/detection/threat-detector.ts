/**
 * Threat Detection and Automated Response System
 * Implements real-time threat detection, behavioral analysis,
 * and automated response capabilities
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import { AuditLogger } from '../logging/audit-logger';

// Threat Detection Schema Definitions
export const ThreatSignatureSchema = z.object({
  signatureId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  category: z.enum([
    'malware', 'exploit', 'suspicious_behavior', 'data_exfiltration',
    'privilege_escalation', 'lateral_movement', 'command_injection',
    'sql_injection', 'xss', 'csrf', 'brute_force', 'dos', 'anomaly'
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(100),
  pattern: z.object({
    type: z.enum(['regex', 'hash', 'yara', 'behavioral', 'statistical']),
    content: z.string(),
    context: z.enum(['request', 'response', 'header', 'body', 'log', 'behavior']).optional(),
    flags: z.array(z.string()).optional()
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'regex', 'gt', 'lt', 'in', 'not_in']),
    value: z.any(),
    weight: z.number().min(0).max(100).optional()
  })).optional(),
  metadata: z.record(z.any()),
  tags: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  author: z.string(),
  references: z.array(z.string()).optional()
});

export const ThreatEventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.date(),
  type: z.string(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(100),
  source: z.object({
    ip: z.string().optional(),
    userAgent: z.string().optional(),
    userId: z.string().optional(),
    serviceId: z.string().optional(),
    hostname: z.string().optional(),
    country: z.string().optional(),
    asn: z.string().optional()
  }),
  target: z.object({
    resource: z.string().optional(),
    endpoint: z.string().optional(),
    method: z.string().optional(),
    parameters: z.record(z.any()).optional()
  }).optional(),
  signatures: z.array(z.string().uuid()),
  evidence: z.object({
    indicators: z.array(z.object({
      type: z.enum(['ip', 'hash', 'domain', 'url', 'file', 'behavior']),
      value: z.string(),
      confidence: z.number().min(0).max(100)
    })),
    artifacts: z.array(z.object({
      type: z.enum(['request', 'response', 'log', 'file', 'network']),
      content: z.string(),
      encoding: z.enum(['raw', 'base64', 'hex']).optional()
    })).optional(),
    timeline: z.array(z.object({
      timestamp: z.date(),
      action: z.string(),
      details: z.record(z.any())
    })).optional()
  }),
  context: z.record(z.any()),
  status: z.enum(['new', 'investigating', 'confirmed', 'false_positive', 'resolved']),
  assignee: z.string().optional(),
  responseActions: z.array(z.string()).optional(),
  notes: z.array(z.object({
    timestamp: z.date(),
    author: z.string(),
    content: z.string()
  })).optional(),
  relatedEvents: z.array(z.string().uuid()).optional()
});

export const ResponseActionSchema = z.object({
  actionId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum([
    'block_ip', 'block_user', 'quarantine', 'alert', 'notify',
    'rate_limit', 'redirect', 'log', 'escalate', 'custom'
  ]),
  trigger: z.object({
    severity: z.array(z.enum(['low', 'medium', 'high', 'critical'])),
    categories: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(100).optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.any()
    })).optional()
  }),
  parameters: z.record(z.any()),
  timeout: z.number().min(0).optional(), // seconds
  priority: z.number().min(1).max(10),
  isAutomatic: z.boolean(),
  requiresApproval: z.boolean(),
  cooldownPeriod: z.number().min(0).optional(), // seconds
  maxExecutions: z.number().min(1).optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  metadata: z.record(z.any())
});

export type ThreatSignature = z.infer<typeof ThreatSignatureSchema>;
export type ThreatEvent = z.infer<typeof ThreatEventSchema>;
export type ResponseAction = z.infer<typeof ResponseActionSchema>;

export interface BehaviorProfile {
  entityId: string; // User ID, IP, or service ID
  entityType: 'user' | 'ip' | 'service' | 'endpoint';
  baseline: {
    requestRate: { mean: number; stddev: number };
    errorRate: { mean: number; stddev: number };
    accessPatterns: Record<string, number>;
    timePatterns: number[]; // 24-hour activity pattern
    geolocation: { country: string; region: string }[];
    userAgents: string[];
    endpoints: Record<string, number>;
  };
  current: {
    requestRate: number;
    errorRate: number;
    anomalies: {
      type: string;
      score: number;
      timestamp: Date;
    }[];
    riskScore: number;
  };
  updatedAt: Date;
  confidence: number;
}

export interface ThreatIntelligence {
  indicators: {
    type: 'ip' | 'domain' | 'hash' | 'url';
    value: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    source: string;
    firstSeen: Date;
    lastSeen: Date;
    tags: string[];
  }[];
  feeds: {
    name: string;
    url: string;
    format: 'json' | 'csv' | 'xml' | 'stix';
    lastUpdate: Date;
    isActive: boolean;
  }[];
}

export interface DetectionRule {
  ruleId: string;
  name: string;
  description: string;
  query: string; // Query language (e.g., KQL, SQL-like)
  windowSize: number; // seconds
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  suppressionTime?: number; // seconds
}

export class ThreatDetector {
  private signatures: Map<string, ThreatSignature> = new Map();
  private threatEvents: Map<string, ThreatEvent> = new Map();
  private responseActions: Map<string, ResponseAction> = new Map();
  private behaviorProfiles: Map<string, BehaviorProfile> = new Map();
  private threatIntelligence: ThreatIntelligence;
  private detectionRules: Map<string, DetectionRule> = new Map();
  private auditLogger: AuditLogger;
  private activeResponseJobs: Map<string, NodeJS.Timeout> = new Map();
  private suppressedSignatures: Map<string, Date> = new Map();

  constructor() {
    this.auditLogger = new AuditLogger();
    this.threatIntelligence = { indicators: [], feeds: [] };
    this.initializeDefaultSignatures();
    this.initializeDefaultResponseActions();
    this.initializeDetectionRules();
    this.startBehaviorAnalysis();
  }

  /**
   * Analyze event for potential threats
   */
  async analyzeEvent(event: {
    type: string;
    source: ThreatEvent['source'];
    target?: ThreatEvent['target'];
    context: Record<string, any>;
    timestamp?: Date;
  }): Promise<{
    isThreat: boolean;
    threatEvents: ThreatEvent[];
    riskScore: number;
    recommendedActions: string[];
  }> {
    const timestamp = event.timestamp || new Date();
    const threats: ThreatEvent[] = [];
    let maxRiskScore = 0;

    // Check against signatures
    const signatureMatches = await this.matchSignatures(event);
    
    // Check threat intelligence
    const intelligenceMatches = await this.checkThreatIntelligence(event);

    // Behavioral analysis
    const behaviorAnomalies = await this.analyzeBehavior(event);

    // Rule-based detection
    const ruleMatches = await this.evaluateDetectionRules(event);

    // Combine all detection results
    const allMatches = [
      ...signatureMatches,
      ...intelligenceMatches,
      ...behaviorAnomalies,
      ...ruleMatches
    ];

    if (allMatches.length > 0) {
      // Create threat event
      const threatEvent = await this.createThreatEvent(event, allMatches, timestamp);
      threats.push(threatEvent);
      maxRiskScore = Math.max(maxRiskScore, this.calculateRiskScore(threatEvent));

      // Trigger automated responses
      await this.triggerAutomatedResponses(threatEvent);
    }

    const recommendedActions = this.generateRecommendedActions(threats);

    return {
      isThreat: threats.length > 0,
      threatEvents: threats,
      riskScore: maxRiskScore,
      recommendedActions
    };
  }

  /**
   * Report a security event for analysis
   */
  async reportSecurityEvent(event: {
    type: string;
    severity: ThreatEvent['severity'];
    context: Record<string, any>;
    [key: string]: any;
  }): Promise<string> {
    const analysis = await this.analyzeEvent({
      type: event.type,
      source: {
        userId: event.context.userId,
        serviceId: event.context.serviceId,
        ip: event.context.clientIP
      },
      target: event.context.target,
      context: event.context
    });

    if (analysis.isThreat) {
      for (const threatEvent of analysis.threatEvents) {
        await this.auditLogger.logSecurityEvent({
          eventType: 'THREAT_DETECTED',
          severity: 'critical',
          details: {
            threatEventId: threatEvent.eventId,
            type: threatEvent.type,
            riskScore: analysis.riskScore,
            signatures: threatEvent.signatures.length,
            actions: analysis.recommendedActions
          }
        });
      }
    }

    return analysis.threatEvents[0]?.eventId || '';
  }

  /**
   * Create custom threat signature
   */
  async createSignature(signatureData: Omit<ThreatSignature, 'signatureId' | 'createdAt' | 'updatedAt'>): Promise<ThreatSignature> {
    const signature: ThreatSignature = {
      signatureId: crypto.randomUUID(),
      ...signatureData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate signature
    const validationResult = ThreatSignatureSchema.safeParse(signature);
    if (!validationResult.success) {
      throw new Error(`Invalid signature: ${validationResult.error.message}`);
    }

    // Test signature pattern
    await this.validateSignaturePattern(signature);

    this.signatures.set(signature.signatureId, signature);

    await this.auditLogger.logSecurityEvent({
      eventType: 'THREAT_SIGNATURE_CREATED',
      details: {
        signatureId: signature.signatureId,
        name: signature.name,
        category: signature.category,
        severity: signature.severity
      }
    });

    return signature;
  }

  /**
   * Create custom response action
   */
  async createResponseAction(actionData: Omit<ResponseAction, 'actionId' | 'createdAt'>): Promise<ResponseAction> {
    const action: ResponseAction = {
      actionId: crypto.randomUUID(),
      ...actionData,
      createdAt: new Date()
    };

    // Validate action
    const validationResult = ResponseActionSchema.safeParse(action);
    if (!validationResult.success) {
      throw new Error(`Invalid response action: ${validationResult.error.message}`);
    }

    this.responseActions.set(action.actionId, action);

    await this.auditLogger.logSecurityEvent({
      eventType: 'RESPONSE_ACTION_CREATED',
      details: {
        actionId: action.actionId,
        name: action.name,
        type: action.type,
        isAutomatic: action.isAutomatic
      }
    });

    return action;
  }

  /**
   * Get threat event by ID
   */
  getThreatEvent(eventId: string): ThreatEvent | undefined {
    return this.threatEvents.get(eventId);
  }

  /**
   * Update threat event status
   */
  async updateThreatEvent(
    eventId: string,
    updates: Partial<Pick<ThreatEvent, 'status' | 'assignee' | 'notes'>>,
    updatedBy: string
  ): Promise<ThreatEvent> {
    const event = this.threatEvents.get(eventId);
    if (!event) {
      throw new Error('Threat event not found');
    }

    const updatedEvent: ThreatEvent = {
      ...event,
      ...updates
    };

    // Add note if provided
    if (updates.status && updates.status !== event.status) {
      updatedEvent.notes = updatedEvent.notes || [];
      updatedEvent.notes.push({
        timestamp: new Date(),
        author: updatedBy,
        content: `Status changed from ${event.status} to ${updates.status}`
      });
    }

    this.threatEvents.set(eventId, updatedEvent);

    await this.auditLogger.logSecurityEvent({
      eventType: 'THREAT_EVENT_UPDATED',
      details: {
        eventId,
        changes: updates,
        updatedBy
      }
    });

    return updatedEvent;
  }

  /**
   * Get threat statistics
   */
  getThreatStatistics(timeRange?: { from: Date; to: Date }): {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    trends: {
      daily: { date: string; count: number }[];
      hourly: { hour: number; count: number }[];
    };
    topSources: { source: string; count: number }[];
    topTargets: { target: string; count: number }[];
    responseStats: {
      automaticActions: number;
      manualActions: number;
      averageResponseTime: number; // minutes
    };
  } {
    const events = Array.from(this.threatEvents.values());
    
    // Filter by time range
    const filteredEvents = timeRange 
      ? events.filter(e => e.timestamp >= timeRange.from && e.timestamp <= timeRange.to)
      : events;

    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const targetCounts: Record<string, number> = {};

    filteredEvents.forEach(event => {
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;
      
      // Extract category from signatures
      event.signatures.forEach(sigId => {
        const signature = this.signatures.get(sigId);
        if (signature) {
          byCategory[signature.category] = (byCategory[signature.category] || 0) + 1;
        }
      });

      // Count sources
      const sourceKey = event.source.ip || event.source.userId || 'unknown';
      sourceCounts[sourceKey] = (sourceCounts[sourceKey] || 0) + 1;

      // Count targets
      if (event.target?.resource) {
        targetCounts[event.target.resource] = (targetCounts[event.target.resource] || 0) + 1;
      }
    });

    return {
      total: filteredEvents.length,
      bySeverity,
      byCategory,
      byStatus,
      trends: {
        daily: this.calculateDailyTrends(filteredEvents),
        hourly: this.calculateHourlyTrends(filteredEvents)
      },
      topSources: Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topTargets: Object.entries(targetCounts)
        .map(([target, count]) => ({ target, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      responseStats: {
        automaticActions: this.activeResponseJobs.size,
        manualActions: filteredEvents.filter(e => e.assignee).length,
        averageResponseTime: 15 // Mock average
      }
    };
  }

  /**
   * Update threat intelligence feeds
   */
  async updateThreatIntelligence(): Promise<void> {
    for (const feed of this.threatIntelligence.feeds) {
      if (!feed.isActive) continue;

      try {
        // Mock threat intelligence update
        const newIndicators = await this.fetchThreatIntelligence(feed);
        
        // Merge with existing indicators
        const existingValues = new Set(this.threatIntelligence.indicators.map(i => i.value));
        const uniqueIndicators = newIndicators.filter(i => !existingValues.has(i.value));
        
        this.threatIntelligence.indicators.push(...uniqueIndicators);
        feed.lastUpdate = new Date();

        await this.auditLogger.logSecurityEvent({
          eventType: 'THREAT_INTELLIGENCE_UPDATED',
          details: {
            feed: feed.name,
            newIndicators: uniqueIndicators.length,
            totalIndicators: this.threatIntelligence.indicators.length
          }
        });
      } catch (error) {
        await this.auditLogger.logSecurityEvent({
          eventType: 'THREAT_INTELLIGENCE_UPDATE_FAILED',
          details: {
            feed: feed.name,
            error: error.message
          }
        });
      }
    }
  }

  /**
   * Execute manual response action
   */
  async executeResponseAction(actionId: string, threatEventId: string, executedBy: string): Promise<void> {
    const action = this.responseActions.get(actionId);
    const threatEvent = this.threatEvents.get(threatEventId);

    if (!action) throw new Error('Response action not found');
    if (!threatEvent) throw new Error('Threat event not found');

    // Check if action requires approval
    if (action.requiresApproval && !action.isAutomatic) {
      // Would implement approval workflow
    }

    await this.performResponseAction(action, threatEvent, executedBy);
  }

  // Private helper methods
  private async initializeDefaultSignatures(): Promise<void> {
    const defaultSignatures: Omit<ThreatSignature, 'signatureId' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'SQL Injection Attempt',
        description: 'Detects potential SQL injection attacks',
        category: 'sql_injection',
        severity: 'high',
        confidence: 85,
        pattern: {
          type: 'regex',
          content: "('|(\\-\\-)|(;)|(\\|)|(\\*)|(%))+.*(union|select|insert|delete|update|drop|create|alter|exec|execute)",
          context: 'request'
        },
        metadata: { source: 'built-in' },
        tags: ['web', 'injection'],
        isActive: true,
        author: 'system'
      },
      {
        name: 'Brute Force Login',
        description: 'Detects brute force login attempts',
        category: 'brute_force',
        severity: 'medium',
        confidence: 75,
        pattern: {
          type: 'behavioral',
          content: 'failed_login_rate > 10/minute',
          context: 'behavior'
        },
        conditions: [
          { field: 'eventType', operator: 'equals', value: 'login_failed', weight: 100 },
          { field: 'timeWindow', operator: 'equals', value: 60, weight: 80 }
        ],
        metadata: { source: 'built-in' },
        tags: ['authentication', 'brute_force'],
        isActive: true,
        author: 'system'
      },
      {
        name: 'Command Injection',
        description: 'Detects command injection attempts',
        category: 'command_injection',
        severity: 'critical',
        confidence: 90,
        pattern: {
          type: 'regex',
          content: '(;|\\||&|`|\\$\\(|\\${).*?(ls|cat|grep|wget|curl|nc|bash|sh|cmd|powershell)',
          context: 'request'
        },
        metadata: { source: 'built-in' },
        tags: ['web', 'injection', 'rce'],
        isActive: true,
        author: 'system'
      }
    ];

    for (const signatureData of defaultSignatures) {
      await this.createSignature(signatureData);
    }
  }

  private async initializeDefaultResponseActions(): Promise<void> {
    const defaultActions: Omit<ResponseAction, 'actionId' | 'createdAt'>[] = [
      {
        name: 'Block Source IP',
        description: 'Temporarily block the source IP address',
        type: 'block_ip',
        trigger: {
          severity: ['high', 'critical'],
          confidence: 80
        },
        parameters: {
          duration: 3600, // 1 hour
          scope: 'global'
        },
        priority: 8,
        isAutomatic: true,
        requiresApproval: false,
        cooldownPeriod: 300, // 5 minutes
        isActive: true,
        metadata: { source: 'built-in' }
      },
      {
        name: 'Rate Limit User',
        description: 'Apply rate limiting to suspicious user',
        type: 'rate_limit',
        trigger: {
          severity: ['medium', 'high'],
          categories: ['brute_force']
        },
        parameters: {
          limit: 10,
          window: 60, // per minute
          duration: 1800 // 30 minutes
        },
        priority: 5,
        isAutomatic: true,
        requiresApproval: false,
        isActive: true,
        metadata: { source: 'built-in' }
      },
      {
        name: 'Security Alert',
        description: 'Send alert to security team',
        type: 'alert',
        trigger: {
          severity: ['critical'],
          confidence: 70
        },
        parameters: {
          channels: ['email', 'slack'],
          escalation: true
        },
        priority: 10,
        isAutomatic: true,
        requiresApproval: false,
        isActive: true,
        metadata: { source: 'built-in' }
      }
    ];

    for (const actionData of defaultActions) {
      await this.createResponseAction(actionData);
    }
  }

  private initializeDetectionRules(): void {
    const rules: DetectionRule[] = [
      {
        ruleId: crypto.randomUUID(),
        name: 'High Error Rate',
        description: 'Detect unusually high error rates',
        query: 'status_code >= 400 | stats count by source_ip | where count > 50',
        windowSize: 300, // 5 minutes
        threshold: 50,
        severity: 'medium',
        isActive: true
      },
      {
        ruleId: crypto.randomUUID(),
        name: 'Privilege Escalation Attempt',
        description: 'Detect potential privilege escalation',
        query: 'action = "role_change" AND new_role IN ["admin", "superuser"]',
        windowSize: 60, // 1 minute
        threshold: 1,
        severity: 'high',
        isActive: true
      }
    ];

    rules.forEach(rule => {
      this.detectionRules.set(rule.ruleId, rule);
    });
  }

  private startBehaviorAnalysis(): void {
    // Start periodic behavior analysis
    setInterval(async () => {
      await this.updateBehaviorProfiles();
    }, 60000); // Every minute
  }

  private async matchSignatures(event: any): Promise<any[]> {
    const matches = [];
    
    for (const signature of this.signatures.values()) {
      if (!signature.isActive) continue;

      // Check if signature is suppressed
      const suppressedUntil = this.suppressedSignatures.get(signature.signatureId);
      if (suppressedUntil && suppressedUntil > new Date()) {
        continue;
      }

      const match = await this.evaluateSignature(signature, event);
      if (match.isMatch) {
        matches.push({
          type: 'signature',
          signatureId: signature.signatureId,
          confidence: signature.confidence,
          severity: signature.severity,
          details: match.details
        });
      }
    }

    return matches;
  }

  private async evaluateSignature(signature: ThreatSignature, event: any): Promise<{
    isMatch: boolean;
    details: Record<string, any>;
  }> {
    // Mock signature evaluation
    const isMatch = Math.random() < 0.1; // 10% chance of match
    
    return {
      isMatch,
      details: { pattern: signature.pattern.content }
    };
  }

  private async checkThreatIntelligence(event: any): Promise<any[]> {
    const matches = [];
    
    // Check source IP against threat intelligence
    if (event.source.ip) {
      const indicator = this.threatIntelligence.indicators.find(
        i => i.type === 'ip' && i.value === event.source.ip
      );
      
      if (indicator) {
        matches.push({
          type: 'threat_intelligence',
          indicator: indicator.value,
          confidence: indicator.confidence,
          severity: indicator.severity,
          details: { source: indicator.source, tags: indicator.tags }
        });
      }
    }

    return matches;
  }

  private async analyzeBehavior(event: any): Promise<any[]> {
    const matches = [];
    
    // Get behavior profile for the entity
    const entityId = event.source.userId || event.source.ip || 'unknown';
    const profile = this.behaviorProfiles.get(entityId);
    
    if (profile) {
      // Check for anomalies
      const anomalies = this.detectAnomalies(event, profile);
      matches.push(...anomalies.map(anomaly => ({
        type: 'behavioral_anomaly',
        anomaly: anomaly.type,
        confidence: anomaly.score,
        severity: anomaly.score > 80 ? 'high' : anomaly.score > 60 ? 'medium' : 'low',
        details: { baseline: profile.baseline, current: profile.current }
      })));
    }

    return matches;
  }

  private async evaluateDetectionRules(event: any): Promise<any[]> {
    const matches = [];
    
    for (const rule of this.detectionRules.values()) {
      if (!rule.isActive) continue;

      // Mock rule evaluation
      const isMatch = await this.executeRuleQuery(rule, event);
      if (isMatch) {
        matches.push({
          type: 'detection_rule',
          ruleId: rule.ruleId,
          confidence: 70,
          severity: rule.severity,
          details: { query: rule.query, threshold: rule.threshold }
        });
      }
    }

    return matches;
  }

  private async executeRuleQuery(rule: DetectionRule, event: any): Promise<boolean> {
    // Mock query execution
    return Math.random() < 0.05; // 5% chance
  }

  private detectAnomalies(event: any, profile: BehaviorProfile): any[] {
    const anomalies = [];
    
    // Check request rate anomaly
    if (profile.current.requestRate > profile.baseline.requestRate.mean + 3 * profile.baseline.requestRate.stddev) {
      anomalies.push({
        type: 'high_request_rate',
        score: Math.min(100, (profile.current.requestRate / profile.baseline.requestRate.mean) * 20),
        timestamp: new Date()
      });
    }

    // Check error rate anomaly
    if (profile.current.errorRate > profile.baseline.errorRate.mean + 2 * profile.baseline.errorRate.stddev) {
      anomalies.push({
        type: 'high_error_rate',
        score: Math.min(100, (profile.current.errorRate / profile.baseline.errorRate.mean) * 30),
        timestamp: new Date()
      });
    }

    return anomalies;
  }

  private async createThreatEvent(event: any, matches: any[], timestamp: Date): Promise<ThreatEvent> {
    const eventId = crypto.randomUUID();
    
    const threatEvent: ThreatEvent = {
      eventId,
      timestamp,
      type: event.type,
      severity: this.calculateSeverity(matches),
      confidence: this.calculateConfidence(matches),
      source: event.source,
      target: event.target,
      signatures: matches
        .filter(m => m.type === 'signature')
        .map(m => m.signatureId),
      evidence: {
        indicators: matches.map(m => ({
          type: this.mapMatchToIndicatorType(m.type),
          value: m.indicator || m.signatureId || m.ruleId,
          confidence: m.confidence
        }))
      },
      context: event.context,
      status: 'new'
    };

    this.threatEvents.set(eventId, threatEvent);
    return threatEvent;
  }

  private calculateSeverity(matches: any[]): ThreatEvent['severity'] {
    const severityScores = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const maxSeverity = matches.reduce((max, match) => {
      const score = severityScores[match.severity] || 0;
      return score > max ? score : max;
    }, 0);

    const severityMap = ['info', 'low', 'medium', 'high', 'critical'];
    return severityMap[maxSeverity] as ThreatEvent['severity'];
  }

  private calculateConfidence(matches: any[]): number {
    if (matches.length === 0) return 0;
    
    const avgConfidence = matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length;
    return Math.round(avgConfidence);
  }

  private calculateRiskScore(event: ThreatEvent): number {
    const severityWeights = { info: 10, low: 25, medium: 50, high: 75, critical: 100 };
    const baseScore = severityWeights[event.severity];
    const confidenceMultiplier = event.confidence / 100;
    
    return Math.round(baseScore * confidenceMultiplier);
  }

  private mapMatchToIndicatorType(matchType: string): any {
    const mapping = {
      signature: 'behavior',
      threat_intelligence: 'ip',
      behavioral_anomaly: 'behavior',
      detection_rule: 'behavior'
    };
    return mapping[matchType] || 'behavior';
  }

  private async triggerAutomatedResponses(threatEvent: ThreatEvent): Promise<void> {
    const applicableActions = Array.from(this.responseActions.values())
      .filter(action => this.isActionApplicable(action, threatEvent))
      .sort((a, b) => b.priority - a.priority);

    for (const action of applicableActions) {
      if (action.isAutomatic && !action.requiresApproval) {
        await this.performResponseAction(action, threatEvent, 'system');
      }
    }
  }

  private isActionApplicable(action: ResponseAction, event: ThreatEvent): boolean {
    // Check severity trigger
    if (!action.trigger.severity.includes(event.severity)) {
      return false;
    }

    // Check confidence threshold
    if (action.trigger.confidence && event.confidence < action.trigger.confidence) {
      return false;
    }

    // Check cooldown
    const lastExecution = this.activeResponseJobs.get(action.actionId);
    if (lastExecution && action.cooldownPeriod) {
      const timeSinceExecution = Date.now() - lastExecution.toString().length;
      if (timeSinceExecution < action.cooldownPeriod * 1000) {
        return false;
      }
    }

    return true;
  }

  private async performResponseAction(action: ResponseAction, event: ThreatEvent, executedBy: string): Promise<void> {
    try {
      // Execute the action based on type
      switch (action.type) {
        case 'block_ip':
          await this.blockIP(event.source.ip!, action.parameters);
          break;
        case 'block_user':
          await this.blockUser(event.source.userId!, action.parameters);
          break;
        case 'rate_limit':
          await this.applyRateLimit(event.source, action.parameters);
          break;
        case 'alert':
          await this.sendAlert(event, action.parameters);
          break;
        case 'notify':
          await this.sendNotification(event, action.parameters);
          break;
      }

      // Log the action
      await this.auditLogger.logSecurityEvent({
        eventType: 'RESPONSE_ACTION_EXECUTED',
        details: {
          actionId: action.actionId,
          actionType: action.type,
          threatEventId: event.eventId,
          executedBy,
          parameters: action.parameters
        }
      });

      // Update threat event
      if (!event.responseActions) {
        event.responseActions = [];
      }
      event.responseActions.push(action.actionId);

    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        eventType: 'RESPONSE_ACTION_FAILED',
        details: {
          actionId: action.actionId,
          threatEventId: event.eventId,
          error: error.message
        }
      });
    }
  }

  private async blockIP(ip: string, parameters: any): Promise<void> {
    // Mock IP blocking implementation
    console.log(`Blocking IP ${ip} for ${parameters.duration} seconds`);
  }

  private async blockUser(userId: string, parameters: any): Promise<void> {
    // Mock user blocking implementation
    console.log(`Blocking user ${userId}`);
  }

  private async applyRateLimit(source: ThreatEvent['source'], parameters: any): Promise<void> {
    // Mock rate limiting implementation
    console.log(`Applying rate limit: ${parameters.limit} requests per ${parameters.window} seconds`);
  }

  private async sendAlert(event: ThreatEvent, parameters: any): Promise<void> {
    // Mock alerting implementation
    console.log(`Sending alert for threat event ${event.eventId}`);
  }

  private async sendNotification(event: ThreatEvent, parameters: any): Promise<void> {
    // Mock notification implementation
    console.log(`Sending notification for threat event ${event.eventId}`);
  }

  private generateRecommendedActions(events: ThreatEvent[]): string[] {
    const recommendations = [];
    
    const criticalEvents = events.filter(e => e.severity === 'critical');
    if (criticalEvents.length > 0) {
      recommendations.push('Immediately investigate critical threats');
    }

    const bruteForceEvents = events.filter(e => 
      e.signatures.some(sigId => {
        const sig = this.signatures.get(sigId);
        return sig?.category === 'brute_force';
      })
    );
    if (bruteForceEvents.length > 0) {
      recommendations.push('Consider implementing account lockout policies');
    }

    return recommendations;
  }

  private async validateSignaturePattern(signature: ThreatSignature): Promise<void> {
    // Mock pattern validation
    if (signature.pattern.type === 'regex') {
      try {
        new RegExp(signature.pattern.content);
      } catch (error) {
        throw new Error(`Invalid regex pattern: ${error.message}`);
      }
    }
  }

  private async updateBehaviorProfiles(): Promise<void> {
    // Mock behavior profile updates
    // In production, would analyze recent events and update baselines
  }

  private async fetchThreatIntelligence(feed: any): Promise<any[]> {
    // Mock threat intelligence fetching
    return [];
  }

  private calculateDailyTrends(events: ThreatEvent[]): { date: string; count: number }[] {
    // Mock daily trends calculation
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 20)
      };
    });
    
    return last7Days.reverse();
  }

  private calculateHourlyTrends(events: ThreatEvent[]): { hour: number; count: number }[] {
    // Mock hourly trends calculation
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: Math.floor(Math.random() * 10)
    }));
  }
}

export { ThreatDetector };