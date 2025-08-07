/**
 * Compliance Automation Service
 * Automated regulatory compliance scanning and reporting for GDPR, HIPAA, SOC2, PCI-DSS
 * Includes evidence collection, audit trails, and remediation workflows
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { PolicyEngine, PolicyContext, PolicyEvaluationResult } from './policy-engine';

// Compliance Framework Definitions
export enum ComplianceFramework {
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  SOC2 = 'soc2',
  PCI_DSS = 'pci-dss',
  ISO27001 = 'iso-27001',
  NIST = 'nist',
  CIS = 'cis'
}

// Control Mapping Schema
export const ControlMappingSchema = z.object({
  id: z.string(),
  framework: z.nativeEnum(ComplianceFramework),
  controlId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  requirements: z.array(z.string()),
  policies: z.array(z.string()),
  automationLevel: z.enum(['fully-automated', 'partially-automated', 'manual']),
  frequency: z.enum(['continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually']),
  evidenceTypes: z.array(z.string()),
  remediation: z.object({
    automated: z.boolean(),
    workflows: z.array(z.string()),
    approvers: z.array(z.string())
  })
});

export type ControlMapping = z.infer<typeof ControlMappingSchema>;

// Compliance Assessment Result
export interface ComplianceAssessment {
  id: string;
  framework: ComplianceFramework;
  timestamp: Date;
  scope: {
    services: string[];
    teams: string[];
    environments: string[];
  };
  results: {
    totalControls: number;
    compliantControls: number;
    nonCompliantControls: number;
    notApplicable: number;
    controlResults: ControlResult[];
  };
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  gaps: ComplianceGap[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  nextAssessment: Date;
}

export interface ControlResult {
  controlId: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
  score: number;
  findings: Finding[];
  evidence: Evidence[];
  lastChecked: Date;
  remediation?: RemediationAction[];
}

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'policy-violation' | 'missing-control' | 'configuration-issue' | 'process-gap';
  description: string;
  resource: {
    type: string;
    id: string;
    location: string;
  };
  evidence: Evidence[];
  remediation: string;
  dueDate?: Date;
  assignee?: string;
}

export interface Evidence {
  id: string;
  type: 'policy' | 'configuration' | 'log' | 'certificate' | 'document' | 'screenshot';
  source: string;
  timestamp: Date;
  hash: string;
  metadata: Record<string, any>;
  retention: {
    period: number; // days
    encrypted: boolean;
    location: string;
  };
}

export interface ComplianceGap {
  controlId: string;
  framework: ComplianceFramework;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  timeline: string;
  dependencies: string[];
}

export interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'policy' | 'technical' | 'process' | 'training';
  description: string;
  benefitedControls: string[];
  estimatedEffort: string;
  costBenefit: string;
}

export interface RemediationAction {
  id: string;
  type: 'automated' | 'workflow' | 'manual';
  description: string;
  script?: string;
  approvalRequired: boolean;
  approvers: string[];
  timeline: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

// Audit Event for compliance tracking
export interface AuditEvent {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  resource: {
    type: string;
    id: string;
  };
  details: Record<string, any>;
  complianceRelevant: boolean;
  frameworks: ComplianceFramework[];
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  retention: number; // days
}

export class ComplianceAutomationService extends EventEmitter {
  private policyEngine: PolicyEngine;
  private controlMappings: Map<string, ControlMapping> = new Map();
  private assessmentHistory: Map<string, ComplianceAssessment> = new Map();
  private auditLog: AuditEvent[] = [];
  private evidenceStore: Map<string, Evidence> = new Map();
  private remediationWorkflows: Map<string, RemediationAction[]> = new Map();

  constructor(policyEngine: PolicyEngine) {
    super();
    this.policyEngine = policyEngine;
    this.initializeComplianceFrameworks();
  }

  /**
   * Perform comprehensive compliance assessment
   */
  async performAssessment(
    framework: ComplianceFramework,
    scope: {
      services?: string[];
      teams?: string[];
      environments?: string[];
    } = {}
  ): Promise<ComplianceAssessment> {
    const assessmentId = this.generateAssessmentId();
    const timestamp = new Date();

    try {
      // Get applicable controls for framework
      const controls = this.getControlsForFramework(framework);
      const controlResults: ControlResult[] = [];
      const allEvidence: Evidence[] = [];
      const gaps: ComplianceGap[] = [];

      // Evaluate each control
      for (const control of controls) {
        const result = await this.evaluateControl(control, scope);
        controlResults.push(result);
        allEvidence.push(...result.evidence);

        // Identify gaps
        if (result.status === 'non-compliant' || result.status === 'partial') {
          gaps.push(await this.identifyControlGap(control, result));
        }
      }

      // Calculate compliance metrics
      const compliantControls = controlResults.filter(r => r.status === 'compliant').length;
      const nonCompliantControls = controlResults.filter(r => r.status === 'non-compliant').length;
      const notApplicable = controlResults.filter(r => r.status === 'not-applicable').length;
      const overallScore = this.calculateComplianceScore(controlResults);
      const riskLevel = this.assessRiskLevel(controlResults);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(controlResults, gaps);

      const assessment: ComplianceAssessment = {
        id: assessmentId,
        framework,
        timestamp,
        scope,
        results: {
          totalControls: controls.length,
          compliantControls,
          nonCompliantControls,
          notApplicable,
          controlResults
        },
        overallScore,
        riskLevel,
        gaps,
        recommendations,
        evidence: allEvidence,
        nextAssessment: this.calculateNextAssessmentDate(framework)
      };

      // Store assessment
      this.assessmentHistory.set(assessmentId, assessment);

      // Emit event
      this.emit('assessmentCompleted', assessment);

      // Trigger automated remediation if enabled
      await this.triggerAutomatedRemediation(assessment);

      return assessment;

    } catch (error) {
      this.emit('assessmentError', { framework, scope, error });
      throw error;
    }
  }

  /**
   * Continuous compliance monitoring
   */
  async startContinuousMonitoring(frameworks: ComplianceFramework[]): Promise<void> {
    for (const framework of frameworks) {
      const controls = this.getControlsForFramework(framework);
      
      for (const control of controls) {
        if (control.frequency === 'continuous') {
          this.setupContinuousMonitoring(control);
        }
      }
    }

    this.emit('continuousMonitoringStarted', frameworks);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    framework: ComplianceFramework,
    reportType: 'executive' | 'detailed' | 'technical' = 'detailed'
  ): Promise<{
    summary: any;
    details: any;
    recommendations: any;
    evidence: any;
  }> {
    const latestAssessment = await this.getLatestAssessment(framework);
    if (!latestAssessment) {
      throw new Error(`No assessment found for framework ${framework}`);
    }

    const summary = this.generateReportSummary(latestAssessment, reportType);
    const details = this.generateReportDetails(latestAssessment, reportType);
    const recommendations = this.generateReportRecommendations(latestAssessment);
    const evidence = this.generateReportEvidence(latestAssessment, reportType);

    return { summary, details, recommendations, evidence };
  }

  /**
   * Track audit event for compliance
   */
  async trackAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event
    };

    this.auditLog.push(auditEvent);

    // Store evidence if compliance relevant
    if (event.complianceRelevant) {
      const evidence = await this.createEvidenceFromAuditEvent(auditEvent);
      this.evidenceStore.set(evidence.id, evidence);
    }

    this.emit('auditEventTracked', auditEvent);
    return auditEvent.id;
  }

  /**
   * Collect evidence for compliance
   */
  async collectEvidence(
    type: Evidence['type'],
    source: string,
    metadata: Record<string, any>,
    retentionDays: number = 2555 // 7 years default
  ): Promise<Evidence> {
    const evidence: Evidence = {
      id: crypto.randomUUID(),
      type,
      source,
      timestamp: new Date(),
      hash: crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
      metadata,
      retention: {
        period: retentionDays,
        encrypted: true,
        location: 'evidence-store'
      }
    };

    this.evidenceStore.set(evidence.id, evidence);
    this.emit('evidenceCollected', evidence);

    return evidence;
  }

  /**
   * Execute remediation workflow
   */
  async executeRemediation(actionId: string): Promise<void> {
    const workflows = Array.from(this.remediationWorkflows.values()).flat();
    const action = workflows.find(a => a.id === actionId);

    if (!action) {
      throw new Error(`Remediation action ${actionId} not found`);
    }

    try {
      action.status = 'in-progress';
      this.emit('remediationStarted', action);

      if (action.type === 'automated' && action.script) {
        await this.executeRemediationScript(action.script);
      }

      action.status = 'completed';
      this.emit('remediationCompleted', action);

    } catch (error) {
      action.status = 'failed';
      this.emit('remediationFailed', { action, error });
      throw error;
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(): Promise<{
    overview: any;
    frameworkStatus: any;
    riskMetrics: any;
    trends: any;
    alerts: any;
  }> {
    const overview = await this.getComplianceOverview();
    const frameworkStatus = await this.getFrameworkStatus();
    const riskMetrics = await this.getRiskMetrics();
    const trends = await this.getComplianceTrends();
    const alerts = await this.getComplianceAlerts();

    return {
      overview,
      frameworkStatus,
      riskMetrics,
      trends,
      alerts
    };
  }

  // Private methods

  private async evaluateControl(
    control: ControlMapping,
    scope: any
  ): Promise<ControlResult> {
    const findings: Finding[] = [];
    const evidence: Evidence[] = [];
    let status: ControlResult['status'] = 'compliant';
    let score = 100;

    // Evaluate policies associated with control
    for (const policyId of control.policies) {
      const context: PolicyContext = {
        subject: { service: 'compliance-scanner' },
        resource: { type: 'control', id: control.id, attributes: control },
        action: 'evaluate',
        environment: { time: new Date() },
        metadata: { framework: control.framework, scope }
      };

      try {
        const results = await this.policyEngine.evaluatePolicy(policyId, context);
        
        for (const result of results) {
          if (result.decision === 'deny' || result.decision === 'warn') {
            const finding: Finding = {
              id: crypto.randomUUID(),
              severity: result.metadata.severity as Finding['severity'],
              type: 'policy-violation',
              description: result.message,
              resource: {
                type: context.resource.type,
                id: context.resource.id,
                location: 'policy-engine'
              },
              evidence: [],
              remediation: result.remediation || 'Review and update policy compliance'
            };

            findings.push(finding);
            
            if (result.decision === 'deny') {
              status = 'non-compliant';
              score -= 20;
            } else {
              status = status === 'compliant' ? 'partial' : status;
              score -= 10;
            }
          }
        }
      } catch (error) {
        console.error(`Failed to evaluate policy ${policyId}:`, error);
      }
    }

    // Collect evidence for control
    const controlEvidence = await this.collectControlEvidence(control);
    evidence.push(...controlEvidence);

    return {
      controlId: control.id,
      status,
      score: Math.max(0, score),
      findings,
      evidence,
      lastChecked: new Date(),
      remediation: findings.length > 0 ? await this.generateRemediationActions(control, findings) : undefined
    };
  }

  private async collectControlEvidence(control: ControlMapping): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    for (const evidenceType of control.evidenceTypes) {
      try {
        const evidenceData = await this.gatherEvidenceByType(evidenceType, control);
        if (evidenceData) {
          const evidenceItem = await this.collectEvidence(
            evidenceType as Evidence['type'],
            `control-${control.id}`,
            evidenceData
          );
          evidence.push(evidenceItem);
        }
      } catch (error) {
        console.error(`Failed to collect evidence of type ${evidenceType}:`, error);
      }
    }

    return evidence;
  }

  private async gatherEvidenceByType(
    evidenceType: string,
    control: ControlMapping
  ): Promise<Record<string, any> | null> {
    switch (evidenceType) {
      case 'policy':
        return {
          policies: control.policies,
          timestamp: new Date(),
          controlId: control.id
        };
      case 'configuration':
        return await this.getSystemConfigurations(control);
      case 'log':
        return await this.getRelevantLogs(control);
      case 'certificate':
        return await this.getCertificates(control);
      default:
        return null;
    }
  }

  private async getSystemConfigurations(control: ControlMapping): Promise<Record<string, any>> {
    // In production, integrate with configuration management systems
    return {
      controlId: control.id,
      framework: control.framework,
      configurations: {},
      timestamp: new Date()
    };
  }

  private async getRelevantLogs(control: ControlMapping): Promise<Record<string, any>> {
    // In production, query logging systems
    return {
      controlId: control.id,
      framework: control.framework,
      logEntries: [],
      timeRange: '24h',
      timestamp: new Date()
    };
  }

  private async getCertificates(control: ControlMapping): Promise<Record<string, any>> {
    // In production, integrate with certificate management
    return {
      controlId: control.id,
      certificates: [],
      timestamp: new Date()
    };
  }

  private async identifyControlGap(
    control: ControlMapping,
    result: ControlResult
  ): Promise<ComplianceGap> {
    return {
      controlId: control.id,
      framework: control.framework,
      description: `Control ${control.id} is ${result.status}`,
      impact: this.assessGapImpact(result),
      effort: this.assessRemediationEffort(control, result),
      timeline: this.estimateRemediationTimeline(control, result),
      dependencies: []
    };
  }

  private assessGapImpact(result: ControlResult): 'high' | 'medium' | 'low' {
    const criticalFindings = result.findings.filter(f => f.severity === 'critical').length;
    const highFindings = result.findings.filter(f => f.severity === 'high').length;

    if (criticalFindings > 0) return 'high';
    if (highFindings > 1) return 'high';
    if (result.score < 50) return 'high';
    if (result.score < 80) return 'medium';
    return 'low';
  }

  private assessRemediationEffort(
    control: ControlMapping,
    result: ControlResult
  ): 'high' | 'medium' | 'low' {
    if (control.automationLevel === 'fully-automated') return 'low';
    if (control.automationLevel === 'partially-automated') return 'medium';
    return 'high';
  }

  private estimateRemediationTimeline(
    control: ControlMapping,
    result: ControlResult
  ): string {
    const severity = this.assessGapImpact(result);
    const effort = this.assessRemediationEffort(control, result);

    if (severity === 'high' && effort === 'low') return '1-2 weeks';
    if (severity === 'high' && effort === 'medium') return '2-4 weeks';
    if (severity === 'high' && effort === 'high') return '1-3 months';
    if (severity === 'medium' && effort === 'low') return '2-4 weeks';
    if (severity === 'medium' && effort === 'medium') return '1-2 months';
    if (severity === 'medium' && effort === 'high') return '2-6 months';
    return '3-6 months';
  }

  private calculateComplianceScore(controlResults: ControlResult[]): number {
    if (controlResults.length === 0) return 0;
    
    const totalScore = controlResults.reduce((sum, result) => sum + result.score, 0);
    return Math.round(totalScore / controlResults.length);
  }

  private assessRiskLevel(controlResults: ControlResult[]): 'low' | 'medium' | 'high' | 'critical' {
    const nonCompliantCritical = controlResults.filter(r => 
      r.status === 'non-compliant' && 
      r.findings.some(f => f.severity === 'critical')
    ).length;

    const nonCompliantHigh = controlResults.filter(r => 
      r.status === 'non-compliant' && 
      r.findings.some(f => f.severity === 'high')
    ).length;

    const overallScore = this.calculateComplianceScore(controlResults);

    if (nonCompliantCritical > 0 || overallScore < 50) return 'critical';
    if (nonCompliantHigh > 2 || overallScore < 70) return 'high';
    if (overallScore < 85) return 'medium';
    return 'low';
  }

  private async generateRecommendations(
    controlResults: ControlResult[],
    gaps: ComplianceGap[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Priority recommendations based on gaps
    const criticalGaps = gaps.filter(g => g.impact === 'high');
    if (criticalGaps.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'critical',
        category: 'technical',
        description: `Address ${criticalGaps.length} critical compliance gaps immediately`,
        benefitedControls: criticalGaps.map(g => g.controlId),
        estimatedEffort: '1-3 months',
        costBenefit: 'High - prevents regulatory violations'
      });
    }

    // Automation opportunities
    const manualControls = controlResults.filter(r => 
      this.getControlMapping(r.controlId)?.automationLevel === 'manual'
    );
    if (manualControls.length > 5) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'medium',
        category: 'process',
        description: 'Automate manual compliance controls to reduce effort and improve accuracy',
        benefitedControls: manualControls.map(c => c.controlId),
        estimatedEffort: '2-6 months',
        costBenefit: 'Medium - reduces ongoing operational overhead'
      });
    }

    return recommendations;
  }

  private async generateRemediationActions(
    control: ControlMapping,
    findings: Finding[]
  ): Promise<RemediationAction[]> {
    const actions: RemediationAction[] = [];

    for (const finding of findings) {
      if (control.remediation.automated) {
        actions.push({
          id: crypto.randomUUID(),
          type: 'automated',
          description: `Automated remediation for ${finding.description}`,
          script: finding.remediation,
          approvalRequired: false,
          approvers: [],
          timeline: 'immediate',
          status: 'pending'
        });
      } else {
        actions.push({
          id: crypto.randomUUID(),
          type: 'workflow',
          description: finding.remediation,
          approvalRequired: true,
          approvers: control.remediation.approvers,
          timeline: this.estimateRemediationTimeline(control, { findings } as ControlResult),
          status: 'pending'
        });
      }
    }

    return actions;
  }

  private getControlsForFramework(framework: ComplianceFramework): ControlMapping[] {
    return Array.from(this.controlMappings.values())
      .filter(mapping => mapping.framework === framework);
  }

  private getControlMapping(controlId: string): ControlMapping | undefined {
    return this.controlMappings.get(controlId);
  }

  private calculateNextAssessmentDate(framework: ComplianceFramework): Date {
    const now = new Date();
    const nextDate = new Date(now);

    // Default assessment frequencies by framework
    switch (framework) {
      case ComplianceFramework.SOC2:
        nextDate.setMonth(now.getMonth() + 3); // Quarterly
        break;
      case ComplianceFramework.PCI_DSS:
        nextDate.setMonth(now.getMonth() + 12); // Annually
        break;
      case ComplianceFramework.GDPR:
        nextDate.setMonth(now.getMonth() + 6); // Semi-annually
        break;
      case ComplianceFramework.HIPAA:
        nextDate.setMonth(now.getMonth() + 12); // Annually
        break;
      default:
        nextDate.setMonth(now.getMonth() + 6); // Default semi-annually
    }

    return nextDate;
  }

  private generateAssessmentId(): string {
    return `assessment_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private async triggerAutomatedRemediation(assessment: ComplianceAssessment): Promise<void> {
    for (const controlResult of assessment.results.controlResults) {
      if (controlResult.remediation) {
        const automatedActions = controlResult.remediation.filter(a => 
          a.type === 'automated' && !a.approvalRequired
        );

        for (const action of automatedActions) {
          try {
            await this.executeRemediation(action.id);
          } catch (error) {
            console.error(`Failed to execute automated remediation ${action.id}:`, error);
          }
        }
      }
    }
  }

  private setupContinuousMonitoring(control: ControlMapping): void {
    // Set up continuous monitoring for control
    // This would integrate with monitoring systems in production
    console.log(`Setting up continuous monitoring for control ${control.id}`);
  }

  private async executeRemediationScript(script: string): Promise<void> {
    // In production, execute remediation scripts securely
    console.log(`Executing remediation script: ${script}`);
  }

  private async getLatestAssessment(framework: ComplianceFramework): Promise<ComplianceAssessment | null> {
    const assessments = Array.from(this.assessmentHistory.values())
      .filter(a => a.framework === framework)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return assessments[0] || null;
  }

  private generateReportSummary(assessment: ComplianceAssessment, reportType: string): any {
    return {
      framework: assessment.framework,
      assessmentDate: assessment.timestamp,
      overallScore: assessment.overallScore,
      riskLevel: assessment.riskLevel,
      complianceRate: (assessment.results.compliantControls / assessment.results.totalControls) * 100,
      totalFindings: assessment.results.controlResults.reduce((sum, r) => sum + r.findings.length, 0),
      criticalFindings: assessment.results.controlResults
        .reduce((sum, r) => sum + r.findings.filter(f => f.severity === 'critical').length, 0)
    };
  }

  private generateReportDetails(assessment: ComplianceAssessment, reportType: string): any {
    return {
      controlResults: assessment.results.controlResults,
      gaps: assessment.gaps,
      nonCompliantControls: assessment.results.controlResults
        .filter(r => r.status === 'non-compliant')
    };
  }

  private generateReportRecommendations(assessment: ComplianceAssessment): any {
    return {
      recommendations: assessment.recommendations,
      priorityActions: assessment.recommendations
        .filter(r => r.priority === 'critical' || r.priority === 'high')
        .sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
    };
  }

  private generateReportEvidence(assessment: ComplianceAssessment, reportType: string): any {
    if (reportType === 'executive') {
      return { evidenceCount: assessment.evidence.length };
    }

    return {
      evidence: assessment.evidence.map(e => ({
        id: e.id,
        type: e.type,
        source: e.source,
        timestamp: e.timestamp,
        hash: e.hash
      }))
    };
  }

  private async createEvidenceFromAuditEvent(event: AuditEvent): Promise<Evidence> {
    return {
      id: crypto.randomUUID(),
      type: 'log',
      source: 'audit-log',
      timestamp: event.timestamp,
      hash: crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex'),
      metadata: {
        auditEventId: event.id,
        user: event.user,
        action: event.action,
        resource: event.resource,
        frameworks: event.frameworks
      },
      retention: {
        period: event.retention,
        encrypted: event.classification === 'confidential' || event.classification === 'restricted',
        location: 'audit-store'
      }
    };
  }

  private async getComplianceOverview(): Promise<any> {
    const assessments = Array.from(this.assessmentHistory.values());
    const frameworks = Object.values(ComplianceFramework);
    
    return {
      totalFrameworks: frameworks.length,
      activeAssessments: assessments.length,
      overallComplianceScore: this.calculateOverallComplianceScore(assessments),
      totalEvidenceItems: this.evidenceStore.size,
      auditEvents: this.auditLog.length
    };
  }

  private async getFrameworkStatus(): Promise<any> {
    const status: Record<string, any> = {};
    
    for (const framework of Object.values(ComplianceFramework)) {
      const assessment = await this.getLatestAssessment(framework);
      status[framework] = {
        lastAssessment: assessment?.timestamp,
        complianceScore: assessment?.overallScore || 0,
        riskLevel: assessment?.riskLevel || 'unknown',
        nextAssessment: assessment?.nextAssessment
      };
    }
    
    return status;
  }

  private async getRiskMetrics(): Promise<any> {
    const assessments = Array.from(this.assessmentHistory.values());
    const riskCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    for (const assessment of assessments) {
      riskCounts[assessment.riskLevel]++;
    }
    
    return riskCounts;
  }

  private async getComplianceTrends(): Promise<any> {
    const assessments = Array.from(this.assessmentHistory.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return {
      scoreHistory: assessments.map(a => ({
        date: a.timestamp,
        score: a.overallScore,
        framework: a.framework
      })),
      riskTrend: assessments.map(a => ({
        date: a.timestamp,
        riskLevel: a.riskLevel,
        framework: a.framework
      }))
    };
  }

  private async getComplianceAlerts(): Promise<any> {
    const alerts = [];
    const assessments = Array.from(this.assessmentHistory.values());
    
    for (const assessment of assessments) {
      if (assessment.riskLevel === 'critical') {
        alerts.push({
          type: 'critical-risk',
          framework: assessment.framework,
          message: `Critical compliance risk detected in ${assessment.framework}`,
          timestamp: assessment.timestamp
        });
      }
      
      // Check for overdue assessments
      if (assessment.nextAssessment < new Date()) {
        alerts.push({
          type: 'overdue-assessment',
          framework: assessment.framework,
          message: `Compliance assessment overdue for ${assessment.framework}`,
          timestamp: new Date()
        });
      }
    }
    
    return alerts;
  }

  private calculateOverallComplianceScore(assessments: ComplianceAssessment[]): number {
    if (assessments.length === 0) return 0;
    
    const totalScore = assessments.reduce((sum, a) => sum + a.overallScore, 0);
    return Math.round(totalScore / assessments.length);
  }

  private initializeComplianceFrameworks(): void {
    // Initialize GDPR controls
    this.initializeGDPRControls();
    // Initialize HIPAA controls
    this.initializeHIPAAControls();
    // Initialize SOC2 controls
    this.initializeSOC2Controls();
    // Initialize PCI-DSS controls
    this.initializePCIDSSControls();
  }

  private initializeGDPRControls(): void {
    const gdprControls: ControlMapping[] = [
      {
        id: 'gdpr-art-25',
        framework: ComplianceFramework.GDPR,
        controlId: 'Article 25',
        title: 'Data Protection by Design and by Default',
        description: 'Implement appropriate technical and organisational measures',
        category: 'Technical Safeguards',
        requirements: [
          'Privacy by design implementation',
          'Data minimization',
          'Purpose limitation'
        ],
        policies: ['data-protection', 'privacy-by-design'],
        automationLevel: 'partially-automated',
        frequency: 'continuous',
        evidenceTypes: ['policy', 'configuration', 'log'],
        remediation: {
          automated: false,
          workflows: ['privacy-review'],
          approvers: ['data-protection-officer']
        }
      },
      {
        id: 'gdpr-art-32',
        framework: ComplianceFramework.GDPR,
        controlId: 'Article 32',
        title: 'Security of Processing',
        description: 'Implement appropriate technical and organisational measures',
        category: 'Security',
        requirements: [
          'Encryption of personal data',
          'Ongoing confidentiality and integrity',
          'Data availability and resilience'
        ],
        policies: ['encryption', 'data-security'],
        automationLevel: 'partially-automated',
        frequency: 'daily',
        evidenceTypes: ['configuration', 'certificate'],
        remediation: {
          automated: true,
          workflows: ['security-config'],
          approvers: ['security-team']
        }
      }
    ];

    gdprControls.forEach(control => this.controlMappings.set(control.id, control));
  }

  private initializeHIPAAControls(): void {
    const hipaaControls: ControlMapping[] = [
      {
        id: 'hipaa-164-308',
        framework: ComplianceFramework.HIPAA,
        controlId: '164.308',
        title: 'Administrative Safeguards',
        description: 'Assigned security responsibility',
        category: 'Administrative',
        requirements: [
          'Security officer assignment',
          'Workforce training',
          'Access management'
        ],
        policies: ['security-officer', 'workforce-training'],
        automationLevel: 'manual',
        frequency: 'monthly',
        evidenceTypes: ['document', 'log'],
        remediation: {
          automated: false,
          workflows: ['admin-review'],
          approvers: ['compliance-officer']
        }
      }
    ];

    hipaaControls.forEach(control => this.controlMappings.set(control.id, control));
  }

  private initializeSOC2Controls(): void {
    const soc2Controls: ControlMapping[] = [
      {
        id: 'soc2-cc6-1',
        framework: ComplianceFramework.SOC2,
        controlId: 'CC6.1',
        title: 'Logical and Physical Access Controls',
        description: 'Restricts logical and physical access',
        category: 'Access Controls',
        requirements: [
          'Access provisioning',
          'Access review',
          'Access termination'
        ],
        policies: ['access-control', 'user-provisioning'],
        automationLevel: 'fully-automated',
        frequency: 'continuous',
        evidenceTypes: ['log', 'configuration'],
        remediation: {
          automated: true,
          workflows: ['access-remediation'],
          approvers: ['security-team']
        }
      }
    ];

    soc2Controls.forEach(control => this.controlMappings.set(control.id, control));
  }

  private initializePCIDSSControls(): void {
    const pciControls: ControlMapping[] = [
      {
        id: 'pci-req-3',
        framework: ComplianceFramework.PCI_DSS,
        controlId: 'Requirement 3',
        title: 'Protect Stored Cardholder Data',
        description: 'Protect stored cardholder data',
        category: 'Data Protection',
        requirements: [
          'Data encryption',
          'Key management',
          'Data retention limits'
        ],
        policies: ['data-encryption', 'key-management'],
        automationLevel: 'partially-automated',
        frequency: 'daily',
        evidenceTypes: ['configuration', 'certificate'],
        remediation: {
          automated: true,
          workflows: ['encryption-remediation'],
          approvers: ['security-team']
        }
      }
    ];

    pciControls.forEach(control => this.controlMappings.set(control.id, control));
  }
}