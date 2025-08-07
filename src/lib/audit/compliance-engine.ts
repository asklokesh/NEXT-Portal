import { auditService, AuditAction, AuditResource } from './service';
import { prisma } from '@/lib/db/client';

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'access_control' | 'data_protection' | 'retention' | 'segregation' | 'monitoring' | 'change_management';
  severity: 'low' | 'medium' | 'high' | 'critical';
  standard: 'SOX' | 'GDPR' | 'HIPAA' | 'PCI_DSS' | 'SOC2' | 'ISO27001' | 'NIST' | 'CUSTOM';
  conditions: {
    resources?: AuditResource[];
    actions?: AuditAction[];
    timeWindow?: number; // hours
    threshold?: number;
    userRoles?: string[];
    environments?: string[];
  };
  violation: {
    message: string;
    remediation: string;
    escalation: string[];
  };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  standard: string;
  description: string;
  evidence: {
    auditLogIds: string[];
    summary: string;
    details: Record<string, any>;
  };
  affectedResources: Array<{
    resource: string;
    resourceId: string;
    count: number;
  }>;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolution?: {
    action: string;
    details: string;
    resolvedBy: string;
    resolvedAt: Date;
  };
  detectedAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  id: string;
  reportType: 'periodic' | 'incident' | 'audit_request' | 'regulatory_filing';
  standard: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalEvents: number;
    complianceScore: number;
    violationCount: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  sections: Array<{
    title: string;
    content: string;
    data: any;
    charts?: any[];
  }>;
  violations: ComplianceViolation[];
  recommendations: string[];
  signedBy?: string;
  signedAt?: Date;
  generatedAt: Date;
}

export class ComplianceEngine {
  private static instance: ComplianceEngine;
  private rules: Map<string, ComplianceRule> = new Map();
  private isMonitoring = false;

  static getInstance(): ComplianceEngine {
    if (!ComplianceEngine.instance) {
      ComplianceEngine.instance = new ComplianceEngine();
    }
    return ComplianceEngine.instance;
  }

  constructor() {
    this.initializeDefaultRules();
    this.startRealTimeMonitoring();
  }

  /**
   * Initialize default compliance rules for common standards
   */
  private initializeDefaultRules(): void {
    const defaultRules: ComplianceRule[] = [
      {
        id: 'sox-segregation-01',
        name: 'SOX: Developer Production Access',
        description: 'Developers should not have direct production access',
        category: 'segregation',
        severity: 'high',
        standard: 'SOX',
        conditions: {
          resources: ['service', 'deployment'],
          actions: ['update', 'delete', 'deploy'],
          environments: ['production'],
          userRoles: ['developer', 'intern']
        },
        violation: {
          message: 'Developer accessed production resources directly',
          remediation: 'Review access controls and implement proper approval workflow',
          escalation: ['security-team@company.com', 'compliance-officer@company.com']
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'gdpr-data-export-01',
        name: 'GDPR: Bulk Data Export Monitoring',
        description: 'Monitor and log all bulk data exports for GDPR compliance',
        category: 'data_protection',
        severity: 'medium',
        standard: 'GDPR',
        conditions: {
          actions: ['export'],
          threshold: 100, // More than 100 records
          timeWindow: 1 // Within 1 hour
        },
        violation: {
          message: 'Bulk data export detected without proper documentation',
          remediation: 'Verify legitimate business need and document purpose',
          escalation: ['data-protection-officer@company.com']
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'soc2-privileged-access-01',
        name: 'SOC2: Privileged Access Changes',
        description: 'All privileged access changes must be approved and logged',
        category: 'access_control',
        severity: 'critical',
        standard: 'SOC2',
        conditions: {
          actions: ['permission_grant', 'permission_revoke'],
          resources: ['user', 'api_key']
        },
        violation: {
          message: 'Privileged access change without proper approval trail',
          remediation: 'Implement approval workflow for all privilege changes',
          escalation: ['security-team@company.com', 'ciso@company.com']
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'change-mgmt-01',
        name: 'Change Management: Production Deployments',
        description: 'Production deployments must follow change management process',
        category: 'change_management',
        severity: 'high',
        standard: 'NIST',
        conditions: {
          actions: ['deploy'],
          environments: ['production'],
          timeWindow: 24 // Must have approval within 24 hours
        },
        violation: {
          message: 'Production deployment without change management approval',
          remediation: 'Ensure all production changes go through CAB approval',
          escalation: ['change-manager@company.com']
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'data-retention-01',
        name: 'Data Retention: Automated Cleanup',
        description: 'Ensure data is automatically cleaned up per retention policies',
        category: 'retention',
        severity: 'medium',
        standard: 'GDPR',
        conditions: {
          actions: ['delete', 'archive'],
          resources: ['document', 'user'],
          timeWindow: 168 // 7 days
        },
        violation: {
          message: 'Data retention policy violation detected',
          remediation: 'Review and update automated cleanup procedures',
          escalation: ['data-protection-officer@company.com']
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  /**
   * Start real-time compliance monitoring
   */
  private startRealTimeMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Run checks every 5 minutes
    setInterval(async () => {
      await this.runComplianceChecks();
    }, 5 * 60 * 1000);

    // Daily comprehensive report
    setInterval(async () => {
      await this.generateDailyComplianceReport();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Add or update a compliance rule
   */
  async addRule(rule: Omit<ComplianceRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ComplianceRule> {
    const newRule: ComplianceRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.rules.set(newRule.id, newRule);
    
    // Store in database
    await this.storeRule(newRule);
    
    return newRule;
  }

  /**
   * Update a compliance rule
   */
  async updateRule(ruleId: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date()
    };

    this.rules.set(ruleId, updatedRule);
    await this.storeRule(updatedRule);

    return updatedRule;
  }

  /**
   * Get all compliance rules
   */
  getRules(standard?: string): ComplianceRule[] {
    const allRules = Array.from(this.rules.values());
    return standard ? allRules.filter(r => r.standard === standard) : allRules;
  }

  /**
   * Run compliance checks against recent audit logs
   */
  async runComplianceChecks(lookbackHours = 1): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - lookbackHours * 60 * 60 * 1000);

    // Get recent audit logs
    const recentLogs = await auditService.query({
      startDate: startTime,
      endDate: endTime,
      limit: 1000
    });

    // Check each rule against the logs
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const violation = await this.checkRule(rule, recentLogs);
      if (violation) {
        violations.push(violation);
        await this.storeViolation(violation);
        await this.alertViolation(violation);
      }
    }

    return violations;
  }

  /**
   * Check a specific rule against audit logs
   */
  private async checkRule(rule: ComplianceRule, logs: any[]): Promise<ComplianceViolation | null> {
    // Filter logs based on rule conditions
    let relevantLogs = logs;

    if (rule.conditions.resources) {
      relevantLogs = relevantLogs.filter(log => 
        rule.conditions.resources!.includes(log.resource as AuditResource)
      );
    }

    if (rule.conditions.actions) {
      relevantLogs = relevantLogs.filter(log => 
        rule.conditions.actions!.includes(log.action as AuditAction)
      );
    }

    if (rule.conditions.userRoles) {
      // In production, you'd check user roles from the database
      // For now, simulate role checking
      relevantLogs = relevantLogs.filter(log => {
        const userRole = this.getUserRole(log.userId);
        return rule.conditions.userRoles!.includes(userRole);
      });
    }

    if (rule.conditions.environments) {
      relevantLogs = relevantLogs.filter(log => {
        const environment = log.metadata?.environment;
        return environment && rule.conditions.environments!.includes(environment);
      });
    }

    // Apply threshold check
    if (rule.conditions.threshold && relevantLogs.length < rule.conditions.threshold) {
      return null;
    }

    // If we have relevant logs that match the rule, it's a violation
    if (relevantLogs.length > 0) {
      const affectedResources = this.groupLogsByResource(relevantLogs);

      const violation: ComplianceViolation = {
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        standard: rule.standard,
        description: rule.violation.message,
        evidence: {
          auditLogIds: relevantLogs.map(log => log.id),
          summary: `${relevantLogs.length} events detected violating rule: ${rule.name}`,
          details: {
            timeWindow: rule.conditions.timeWindow,
            eventCount: relevantLogs.length,
            uniqueUsers: new Set(relevantLogs.map(log => log.userId)).size,
            affectedSystems: new Set(relevantLogs.map(log => log.resource)).size
          }
        },
        affectedResources,
        status: 'open',
        detectedAt: new Date(),
        updatedAt: new Date()
      };

      return violation;
    }

    return null;
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(
    standard: string,
    startDate: Date,
    endDate: Date,
    reportType: ComplianceReport['reportType'] = 'periodic'
  ): Promise<ComplianceReport> {
    // Get all audit logs for the period
    const logs = await auditService.query({
      startDate,
      endDate,
      limit: 10000
    });

    // Get all violations for the period
    const violations = await this.getViolations({
      startDate,
      endDate,
      standard
    });

    // Calculate compliance metrics
    const complianceScore = this.calculateComplianceScore(logs, violations);
    const riskLevel = this.calculateRiskLevel(violations);

    // Generate report sections
    const sections = await this.generateReportSections(standard, logs, violations);

    const report: ComplianceReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reportType,
      standard,
      period: { start: startDate, end: endDate },
      summary: {
        totalEvents: logs.length,
        complianceScore,
        violationCount: violations.length,
        riskLevel
      },
      sections,
      violations: violations.filter(v => v.severity === 'high' || v.severity === 'critical'),
      recommendations: this.generateRecommendations(violations),
      generatedAt: new Date()
    };

    await this.storeReport(report);
    return report;
  }

  /**
   * Generate daily compliance report
   */
  private async generateDailyComplianceReport(): Promise<void> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const standards = ['SOX', 'GDPR', 'SOC2', 'HIPAA'];
    
    for (const standard of standards) {
      await this.generateComplianceReport(standard, startDate, endDate, 'periodic');
    }
  }

  /**
   * Get violations with filtering
   */
  async getViolations(filters: {
    standard?: string;
    severity?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ComplianceViolation[]> {
    // In production, this would query the database
    // For now, return mock data
    return [];
  }

  /**
   * Resolve a compliance violation
   */
  async resolveViolation(
    violationId: string,
    resolution: {
      action: string;
      details: string;
      resolvedBy: string;
    }
  ): Promise<boolean> {
    // In production, update violation in database
    await auditService.log('update', 'compliance_violation', violationId, {
      action: 'resolve',
      resolution
    });

    return true;
  }

  /**
   * Get compliance dashboard metrics
   */
  async getDashboardMetrics(days = 30): Promise<{
    overallScore: number;
    riskTrend: 'improving' | 'stable' | 'degrading';
    violationsByStandard: Record<string, number>;
    violationsBySeverity: Record<string, number>;
    recentViolations: ComplianceViolation[];
    complianceByCategory: Record<string, number>;
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const violations = await this.getViolations({ startDate, endDate });
    const logs = await auditService.query({ startDate, endDate, limit: 10000 });

    return {
      overallScore: this.calculateComplianceScore(logs, violations),
      riskTrend: this.calculateRiskTrend(violations),
      violationsByStandard: this.groupViolationsByStandard(violations),
      violationsBySeverity: this.groupViolationsBySeverity(violations),
      recentViolations: violations.slice(0, 10),
      complianceByCategory: this.calculateComplianceByCategory(violations)
    };
  }

  /**
   * Export compliance data for regulatory reporting
   */
  async exportComplianceData(
    standard: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' | 'xml' = 'json'
  ): Promise<string> {
    const logs = await auditService.query({
      startDate,
      endDate,
      limit: 50000
    });

    const violations = await this.getViolations({
      standard,
      startDate,
      endDate
    });

    const exportData = {
      metadata: {
        standard,
        period: { start: startDate, end: endDate },
        exportedAt: new Date(),
        totalEvents: logs.length,
        violationCount: violations.length
      },
      auditLogs: logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata
      })),
      violations: violations.map(v => ({
        id: v.id,
        ruleId: v.ruleId,
        ruleName: v.ruleName,
        severity: v.severity,
        description: v.description,
        status: v.status,
        detectedAt: v.detectedAt,
        evidence: v.evidence
      }))
    };

    // Log the export for audit trail
    await auditService.log('export', 'compliance_data', null, {
      standard,
      format,
      recordCount: logs.length,
      violationCount: violations.length,
      reason: 'Regulatory compliance export'
    });

    switch (format) {
      case 'csv':
        return this.convertToCSV(exportData);
      case 'xml':
        return this.convertToXML(exportData);
      default:
        return JSON.stringify(exportData, null, 2);
    }
  }

  /**
   * Private helper methods
   */

  private getUserRole(userId: string | null): string {
    // In production, query user roles from database
    // For demo, return random roles
    const roles = ['developer', 'admin', 'analyst', 'manager', 'intern'];
    return roles[Math.floor(Math.random() * roles.length)];
  }

  private groupLogsByResource(logs: any[]): Array<{ resource: string; resourceId: string; count: number }> {
    const resourceMap = new Map<string, number>();
    
    logs.forEach(log => {
      const key = `${log.resource}:${log.resourceId || 'null'}`;
      resourceMap.set(key, (resourceMap.get(key) || 0) + 1);
    });

    return Array.from(resourceMap.entries()).map(([key, count]) => {
      const [resource, resourceId] = key.split(':');
      return { resource, resourceId, count };
    });
  }

  private calculateComplianceScore(logs: any[], violations: ComplianceViolation[]): number {
    if (logs.length === 0) return 100;
    
    // Simple scoring: reduce score based on violation severity
    let score = 100;
    violations.forEach(v => {
      switch (v.severity) {
        case 'critical': score -= 10; break;
        case 'high': score -= 5; break;
        case 'medium': score -= 2; break;
        case 'low': score -= 1; break;
      }
    });

    return Math.max(0, score);
  }

  private calculateRiskLevel(violations: ComplianceViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 5) return 'high';
    if (highCount > 0 || violations.length > 10) return 'medium';
    return 'low';
  }

  private calculateRiskTrend(violations: ComplianceViolation[]): 'improving' | 'stable' | 'degrading' {
    // Simple trend calculation based on recent vs older violations
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentViolations = violations.filter(v => v.detectedAt > dayAgo);
    const olderViolations = violations.filter(v => v.detectedAt <= dayAgo);

    if (recentViolations.length < olderViolations.length * 0.8) return 'improving';
    if (recentViolations.length > olderViolations.length * 1.2) return 'degrading';
    return 'stable';
  }

  private groupViolationsByStandard(violations: ComplianceViolation[]): Record<string, number> {
    const groups: Record<string, number> = {};
    violations.forEach(v => {
      groups[v.standard] = (groups[v.standard] || 0) + 1;
    });
    return groups;
  }

  private groupViolationsBySeverity(violations: ComplianceViolation[]): Record<string, number> {
    const groups: Record<string, number> = {};
    violations.forEach(v => {
      groups[v.severity] = (groups[v.severity] || 0) + 1;
    });
    return groups;
  }

  private calculateComplianceByCategory(violations: ComplianceViolation[]): Record<string, number> {
    const categories = ['access_control', 'data_protection', 'retention', 'segregation', 'monitoring', 'change_management'];
    const scores: Record<string, number> = {};
    
    categories.forEach(category => {
      const categoryViolations = violations.filter(v => {
        const rule = this.rules.get(v.ruleId);
        return rule?.category === category;
      });
      scores[category] = Math.max(0, 100 - categoryViolations.length * 5);
    });

    return scores;
  }

  private async generateReportSections(
    standard: string, 
    logs: any[], 
    violations: ComplianceViolation[]
  ): Promise<ComplianceReport['sections']> {
    return [
      {
        title: 'Executive Summary',
        content: `Compliance assessment for ${standard} standard covering ${logs.length} audit events with ${violations.length} violations detected.`,
        data: {
          totalEvents: logs.length,
          violationCount: violations.length,
          complianceScore: this.calculateComplianceScore(logs, violations)
        }
      },
      {
        title: 'Risk Assessment',
        content: 'Analysis of compliance risks and their potential impact on the organization.',
        data: {
          riskLevel: this.calculateRiskLevel(violations),
          criticalViolations: violations.filter(v => v.severity === 'critical').length,
          highViolations: violations.filter(v => v.severity === 'high').length
        }
      },
      {
        title: 'Control Effectiveness',
        content: 'Evaluation of control effectiveness across different categories.',
        data: this.calculateComplianceByCategory(violations)
      }
    ];
  }

  private generateRecommendations(violations: ComplianceViolation[]): string[] {
    const recommendations = [];
    
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    if (criticalCount > 0) {
      recommendations.push('Immediate attention required for critical compliance violations');
    }

    const accessViolations = violations.filter(v => {
      const rule = this.rules.get(v.ruleId);
      return rule?.category === 'access_control';
    });
    if (accessViolations.length > 3) {
      recommendations.push('Review and strengthen access control policies');
    }

    const changeViolations = violations.filter(v => {
      const rule = this.rules.get(v.ruleId);
      return rule?.category === 'change_management';
    });
    if (changeViolations.length > 2) {
      recommendations.push('Implement stricter change management procedures');
    }

    return recommendations;
  }

  private async storeRule(rule: ComplianceRule): Promise<void> {
    // In production, store in database
    console.log('Storing compliance rule:', rule.id);
  }

  private async storeViolation(violation: ComplianceViolation): Promise<void> {
    // In production, store in database
    console.log('Storing compliance violation:', violation.id);
  }

  private async storeReport(report: ComplianceReport): Promise<void> {
    // In production, store in database
    console.log('Storing compliance report:', report.id);
  }

  private async alertViolation(violation: ComplianceViolation): Promise<void> {
    // In production, send alerts via email/Slack/webhooks
    console.log('Alerting compliance violation:', violation.id, violation.severity);
    
    const rule = this.rules.get(violation.ruleId);
    if (rule?.violation.escalation) {
      // Send alerts to escalation contacts
      await auditService.log('alert', 'compliance_violation', violation.id, {
        escalationContacts: rule.violation.escalation,
        severity: violation.severity,
        ruleViolated: rule.name
      });
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in production, use a proper CSV library
    return JSON.stringify(data);
  }

  private convertToXML(data: any): string {
    // Simple XML conversion - in production, use a proper XML library
    return `<complianceExport>${JSON.stringify(data)}</complianceExport>`;
  }
}

// Export singleton instance
export const complianceEngine = ComplianceEngine.getInstance();