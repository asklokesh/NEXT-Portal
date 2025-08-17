/**
 * Enterprise Governance Service
 * 
 * Comprehensive governance features including approval workflows,
 * security scanning, compliance checking, and enterprise controls
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import axios from 'axios';
import { z } from 'zod';

// Governance Schema Definitions
export const ApprovalRequestSchema = z.object({
  id: z.string(),
  requesterId: z.string(),
  requesterName: z.string(),
  requesterEmail: z.string(),
  type: z.enum(['plugin-install', 'plugin-update', 'plugin-remove', 'configuration-change']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  pluginId: z.string(),
  pluginName: z.string(),
  version: z.string().optional(),
  currentVersion: z.string().optional(),
  tenantId: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  reason: z.string(),
  businessJustification: z.string(),
  impactAssessment: z.string(),
  rollbackPlan: z.string().optional(),
  estimatedDowntime: z.string().optional(),
  affectedUsers: z.number().optional(),
  config: z.any().optional(),
  attachments: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().optional(),
  status: z.enum(['pending', 'in-review', 'approved', 'rejected', 'expired', 'cancelled']).default('pending'),
  workflow: z.string(),
  currentStep: z.number().default(0),
  approvers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    required: z.boolean(),
    approved: z.boolean().optional(),
    rejectionReason: z.string().optional(),
    approvedAt: z.date().optional(),
    order: z.number()
  })),
  reviewers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    reviewed: z.boolean().default(false),
    comments: z.string().optional(),
    reviewedAt: z.date().optional()
  })).default([]),
  audit: z.array(z.object({
    timestamp: z.date(),
    action: z.string(),
    actor: z.string(),
    details: z.string().optional()
  })).default([])
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const SecurityScanSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  version: z.string(),
  scanType: z.enum(['dependency', 'code', 'container', 'configuration', 'comprehensive']),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  duration: z.number().optional(),
  findings: z.array(z.object({
    id: z.string(),
    severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
    type: z.enum(['vulnerability', 'malware', 'license', 'compliance', 'best-practice']),
    title: z.string(),
    description: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    remediation: z.string().optional(),
    references: z.array(z.string()).default([]),
    cveId: z.string().optional(),
    cvssScore: z.number().optional(),
    suppressed: z.boolean().default(false),
    suppressionReason: z.string().optional()
  })).default([]),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  metadata: z.record(z.any()).default({})
});

export type SecurityScan = z.infer<typeof SecurityScanSchema>;

export const ComplianceRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['security', 'licensing', 'architecture', 'performance', 'documentation']),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  framework: z.enum(['soc2', 'iso27001', 'gdpr', 'hipaa', 'pci-dss', 'custom']),
  enabled: z.boolean().default(true),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not-equals', 'contains', 'not-contains', 'greater-than', 'less-than', 'regex']),
    value: z.any(),
    required: z.boolean().default(true)
  })),
  actions: z.array(z.object({
    type: z.enum(['block', 'warn', 'require-approval', 'notify', 'audit']),
    parameters: z.record(z.any()).default({})
  })),
  exceptions: z.array(z.object({
    pluginPattern: z.string(),
    reason: z.string(),
    expiresAt: z.date().optional(),
    approvedBy: z.string()
  })).default([])
});

export type ComplianceRule = z.infer<typeof ComplianceRuleSchema>;

export interface GovernanceMetrics {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  averageApprovalTime: number;
  securityScansRun: number;
  securityIssuesFound: number;
  complianceViolations: number;
  timeToApproval: {
    p50: number;
    p90: number;
    p99: number;
  };
  approvalsByEnvironment: Record<string, number>;
  riskScoreDistribution: Record<string, number>;
}

export interface GovernanceConfig {
  enabled: boolean;
  strictMode: boolean;
  defaultWorkflow: string;
  autoApprovalEnabled: boolean;
  autoApprovalCriteria: {
    maxRiskScore: number;
    trustedAuthors: string[];
    trustedPlugins: string[];
    nonProductionEnvironments: boolean;
  };
  securityScanning: {
    enabled: boolean;
    blockOnHighSeverity: boolean;
    blockOnCriticalSeverity: boolean;
    scanTimeout: number;
    requiredScans: string[];
  };
  compliance: {
    enabled: boolean;
    frameworks: string[];
    enforceRules: boolean;
    auditingEnabled: boolean;
  };
  notifications: {
    enabled: boolean;
    channels: string[];
    escalationTimeouts: Record<string, number>;
  };
}

class EnterpriseGovernanceService extends EventEmitter {
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private securityScans: Map<string, SecurityScan> = new Map();
  private complianceRules: Map<string, ComplianceRule> = new Map();
  private workflows: Map<string, any> = new Map();
  private config: GovernanceConfig;

  constructor() {
    super();
    this.config = this.loadGovernanceConfig();
    this.initializeDefaultWorkflows();
    this.initializeComplianceRules();
    this.startBackgroundTasks();
  }

  /**
   * Submit a plugin action for approval
   */
  async submitForApproval(request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currentStep' | 'audit'>): Promise<string> {
    const requestId = this.generateRequestId();
    const workflow = this.workflows.get(request.workflow) || this.workflows.get(this.config.defaultWorkflow);
    
    if (!workflow) {
      throw new Error(`Workflow ${request.workflow} not found`);
    }

    // Perform initial risk assessment
    const riskScore = await this.calculateRiskScore(request);
    
    // Check if auto-approval is possible
    if (this.canAutoApprove(request, riskScore)) {
      return await this.autoApprove(requestId, request);
    }

    // Create approval request
    const approvalRequest: ApprovalRequest = {
      ...request,
      id: requestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      currentStep: 0,
      audit: [{
        timestamp: new Date(),
        action: 'request-submitted',
        actor: request.requesterId,
        details: `Submitted ${request.type} request for ${request.pluginId}`
      }]
    };

    // Run compliance checks
    const complianceResults = await this.runComplianceChecks(approvalRequest);
    if (complianceResults.blocked) {
      approvalRequest.status = 'rejected';
      approvalRequest.audit.push({
        timestamp: new Date(),
        action: 'auto-rejected',
        actor: 'system',
        details: `Blocked by compliance rules: ${complianceResults.violations.join(', ')}`
      });
      
      this.approvalRequests.set(requestId, approvalRequest);
      this.emit('request-rejected', approvalRequest);
      
      throw new Error(`Request blocked by compliance rules: ${complianceResults.violations.join(', ')}`);
    }

    // Start security scanning if required
    if (this.config.securityScanning.enabled && request.type !== 'plugin-remove') {
      const scanId = await this.initiateSecurityScan(request.pluginId, request.version || 'latest');
      approvalRequest.audit.push({
        timestamp: new Date(),
        action: 'security-scan-initiated',
        actor: 'system',
        details: `Security scan started: ${scanId}`
      });
    }

    this.approvalRequests.set(requestId, approvalRequest);
    
    // Start workflow
    await this.processWorkflowStep(requestId);
    
    // Send notifications
    await this.sendNotifications(approvalRequest, 'request-submitted');
    
    this.emit('request-submitted', approvalRequest);
    
    return requestId;
  }

  /**
   * Approve a request
   */
  async approveRequest(requestId: string, approverId: string, comments?: string): Promise<void> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    if (request.status !== 'pending' && request.status !== 'in-review') {
      throw new Error(`Request ${requestId} is not in a state that can be approved`);
    }

    // Find the approver
    const approver = request.approvers.find(a => a.id === approverId);
    if (!approver) {
      throw new Error(`Approver ${approverId} not found for request ${requestId}`);
    }

    if (approver.approved === true) {
      throw new Error(`Request ${requestId} already approved by ${approverId}`);
    }

    // Record approval
    approver.approved = true;
    approver.approvedAt = new Date();
    request.updatedAt = new Date();
    request.audit.push({
      timestamp: new Date(),
      action: 'approved',
      actor: approverId,
      details: comments || 'Approved'
    });

    // Check if all required approvals are complete
    const requiredApprovers = request.approvers.filter(a => a.required);
    const completedApprovals = requiredApprovers.filter(a => a.approved === true);
    
    if (completedApprovals.length === requiredApprovers.length) {
      request.status = 'approved';
      request.audit.push({
        timestamp: new Date(),
        action: 'fully-approved',
        actor: 'system',
        details: 'All required approvals obtained'
      });

      this.emit('request-approved', request);
      await this.sendNotifications(request, 'request-approved');
      
      // Execute the approved action
      await this.executeApprovedAction(request);
    } else {
      // Move to next workflow step
      await this.processWorkflowStep(requestId);
    }

    this.approvalRequests.set(requestId, request);
  }

  /**
   * Reject a request
   */
  async rejectRequest(requestId: string, approverId: string, reason: string): Promise<void> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    if (request.status !== 'pending' && request.status !== 'in-review') {
      throw new Error(`Request ${requestId} is not in a state that can be rejected`);
    }

    // Find the approver
    const approver = request.approvers.find(a => a.id === approverId);
    if (!approver) {
      throw new Error(`Approver ${approverId} not found for request ${requestId}`);
    }

    // Record rejection
    approver.approved = false;
    approver.rejectionReason = reason;
    approver.approvedAt = new Date();
    request.status = 'rejected';
    request.updatedAt = new Date();
    request.audit.push({
      timestamp: new Date(),
      action: 'rejected',
      actor: approverId,
      details: reason
    });

    this.approvalRequests.set(requestId, request);
    this.emit('request-rejected', request);
    await this.sendNotifications(request, 'request-rejected');
  }

  /**
   * Initiate comprehensive security scan
   */
  async initiateSecurityScan(pluginId: string, version: string): Promise<string> {
    const scanId = this.generateScanId();
    
    const scan: SecurityScan = {
      id: scanId,
      pluginId,
      version,
      scanType: 'comprehensive',
      status: 'pending',
      startedAt: new Date(),
      findings: [],
      score: 0,
      passed: false
    };

    this.securityScans.set(scanId, scan);
    
    // Run scans in parallel
    const scanPromises = [
      this.runDependencyScan(scanId),
      this.runCodeScan(scanId),
      this.runLicenseScan(scanId),
      this.runMalwareScan(scanId)
    ];

    // Update scan status to running
    scan.status = 'running';
    this.securityScans.set(scanId, scan);
    
    try {
      await Promise.all(scanPromises);
      
      // Calculate final score and determine if passed
      const finalScan = this.securityScans.get(scanId)!;
      finalScan.score = this.calculateSecurityScore(finalScan.findings);
      finalScan.passed = this.evaluateSecurityResults(finalScan);
      finalScan.status = 'completed';
      finalScan.completedAt = new Date();
      finalScan.duration = finalScan.completedAt.getTime() - finalScan.startedAt.getTime();
      
      this.securityScans.set(scanId, finalScan);
      this.emit('security-scan-completed', finalScan);
      
    } catch (error) {
      scan.status = 'failed';
      scan.completedAt = new Date();
      this.securityScans.set(scanId, scan);
      this.emit('security-scan-failed', scan, error);
    }

    return scanId;
  }

  /**
   * Get security scan results
   */
  getSecurityScan(scanId: string): SecurityScan | null {
    return this.securityScans.get(scanId) || null;
  }

  /**
   * Run compliance checks against a request
   */
  async runComplianceChecks(request: ApprovalRequest): Promise<{
    passed: boolean;
    blocked: boolean;
    violations: string[];
    warnings: string[];
  }> {
    const violations: string[] = [];
    const warnings: string[] = [];

    for (const [ruleId, rule] of this.complianceRules) {
      if (!rule.enabled) continue;

      // Check if there's an exception for this plugin
      const hasException = rule.exceptions.some(ex => {
        const regex = new RegExp(ex.pluginPattern);
        return regex.test(request.pluginId) && 
               (!ex.expiresAt || ex.expiresAt > new Date());
      });

      if (hasException) continue;

      // Evaluate rule conditions
      const ruleViolated = this.evaluateRuleConditions(rule, request);
      
      if (ruleViolated) {
        const hasBlockingAction = rule.actions.some(action => action.type === 'block');
        
        if (hasBlockingAction && rule.severity === 'critical') {
          violations.push(rule.name);
        } else if (rule.severity === 'error') {
          violations.push(rule.name);
        } else {
          warnings.push(rule.name);
        }
      }
    }

    return {
      passed: violations.length === 0,
      blocked: violations.length > 0,
      violations,
      warnings
    };
  }

  /**
   * Get governance metrics and analytics
   */
  async getGovernanceMetrics(timeRange: { start: Date; end: Date }): Promise<GovernanceMetrics> {
    const requests = Array.from(this.approvalRequests.values())
      .filter(r => r.createdAt >= timeRange.start && r.createdAt <= timeRange.end);

    const scans = Array.from(this.securityScans.values())
      .filter(s => s.startedAt >= timeRange.start && s.startedAt <= timeRange.end);

    const approvedRequests = requests.filter(r => r.status === 'approved');
    const rejectedRequests = requests.filter(r => r.status === 'rejected');

    // Calculate approval times
    const approvalTimes = approvedRequests
      .map(r => {
        const lastApproval = Math.max(...r.approvers
          .filter(a => a.approvedAt)
          .map(a => a.approvedAt!.getTime()));
        return lastApproval - r.createdAt.getTime();
      });

    const averageApprovalTime = approvalTimes.length > 0 
      ? approvalTimes.reduce((sum, time) => sum + time, 0) / approvalTimes.length 
      : 0;

    // Calculate percentiles
    const sortedTimes = approvalTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    return {
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === 'pending' || r.status === 'in-review').length,
      approvedRequests: approvedRequests.length,
      rejectedRequests: rejectedRequests.length,
      averageApprovalTime,
      securityScansRun: scans.length,
      securityIssuesFound: scans.reduce((sum, scan) => sum + scan.findings.length, 0),
      complianceViolations: 0, // Would be calculated from audit logs
      timeToApproval: { p50, p90, p99 },
      approvalsByEnvironment: this.groupBy(requests, 'environment'),
      riskScoreDistribution: {} // Would be calculated from risk assessments
    };
  }

  /**
   * Get all pending requests for an approver
   */
  getPendingRequests(approverId: string): ApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .filter(request => 
        (request.status === 'pending' || request.status === 'in-review') &&
        request.approvers.some(a => a.id === approverId && a.approved === undefined)
      );
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): ApprovalRequest | null {
    return this.approvalRequests.get(requestId) || null;
  }

  /**
   * Private helper methods
   */
  private loadGovernanceConfig(): GovernanceConfig {
    return {
      enabled: true,
      strictMode: false,
      defaultWorkflow: 'standard-approval',
      autoApprovalEnabled: true,
      autoApprovalCriteria: {
        maxRiskScore: 30,
        trustedAuthors: ['@backstage', '@roadiehq', '@spotify'],
        trustedPlugins: ['@backstage/plugin-catalog', '@backstage/plugin-auth'],
        nonProductionEnvironments: true
      },
      securityScanning: {
        enabled: true,
        blockOnHighSeverity: true,
        blockOnCriticalSeverity: true,
        scanTimeout: 300000, // 5 minutes
        requiredScans: ['dependency', 'code', 'license']
      },
      compliance: {
        enabled: true,
        frameworks: ['soc2', 'iso27001'],
        enforceRules: true,
        auditingEnabled: true
      },
      notifications: {
        enabled: true,
        channels: ['email', 'slack'],
        escalationTimeouts: {
          'first-reminder': 24 * 60 * 60 * 1000, // 24 hours
          'escalation': 48 * 60 * 60 * 1000 // 48 hours
        }
      }
    };
  }

  private initializeDefaultWorkflows(): void {
    // Standard approval workflow
    this.workflows.set('standard-approval', {
      name: 'Standard Approval',
      steps: [
        { 
          name: 'Security Review', 
          approvers: ['security-team'],
          required: true,
          parallel: false
        },
        { 
          name: 'Technical Review', 
          approvers: ['tech-lead'],
          required: true,
          parallel: false
        },
        { 
          name: 'Business Approval', 
          approvers: ['product-owner'],
          required: true,
          parallel: false
        }
      ]
    });

    // Fast-track workflow for low-risk changes
    this.workflows.set('fast-track', {
      name: 'Fast Track',
      steps: [
        { 
          name: 'Technical Review', 
          approvers: ['tech-lead'],
          required: true,
          parallel: false
        }
      ]
    });

    // Critical change workflow
    this.workflows.set('critical-change', {
      name: 'Critical Change',
      steps: [
        { 
          name: 'Security Review', 
          approvers: ['security-team', 'ciso'],
          required: true,
          parallel: true
        },
        { 
          name: 'Technical Review', 
          approvers: ['tech-lead', 'architect'],
          required: true,
          parallel: true
        },
        { 
          name: 'Executive Approval', 
          approvers: ['cto', 'product-owner'],
          required: true,
          parallel: false
        }
      ]
    });
  }

  private initializeComplianceRules(): void {
    // Example compliance rules
    const rules: ComplianceRule[] = [
      {
        id: 'no-alpha-plugins-prod',
        name: 'No Alpha Plugins in Production',
        description: 'Alpha and beta plugins are not allowed in production environments',
        category: 'security',
        severity: 'critical',
        framework: 'custom',
        enabled: true,
        conditions: [
          { field: 'environment', operator: 'equals', value: 'production', required: true },
          { field: 'version', operator: 'contains', value: 'alpha', required: false },
          { field: 'version', operator: 'contains', value: 'beta', required: false }
        ],
        actions: [{ type: 'block', parameters: {} }],
        exceptions: []
      },
      {
        id: 'require-security-scan',
        name: 'Security Scan Required',
        description: 'All plugins must pass security scanning before deployment',
        category: 'security',
        severity: 'error',
        framework: 'soc2',
        enabled: true,
        conditions: [
          { field: 'type', operator: 'equals', value: 'plugin-install', required: true }
        ],
        actions: [{ type: 'require-approval', parameters: { approver: 'security-team' } }],
        exceptions: []
      }
    ];

    rules.forEach(rule => {
      this.complianceRules.set(rule.id, rule);
    });
  }

  private async calculateRiskScore(request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currentStep' | 'audit'>): Promise<number> {
    let score = 0;

    // Environment risk
    if (request.environment === 'production') score += 40;
    else if (request.environment === 'staging') score += 20;
    else score += 5;

    // Action type risk
    if (request.type === 'plugin-install') score += 30;
    else if (request.type === 'plugin-update') score += 20;
    else if (request.type === 'configuration-change') score += 15;
    else score += 10;

    // Plugin trust level
    const isTrusted = this.config.autoApprovalCriteria.trustedAuthors.some(author => 
      request.pluginId.startsWith(author)
    );
    if (!isTrusted) score += 25;

    // Affected users
    if (request.affectedUsers && request.affectedUsers > 1000) score += 20;
    else if (request.affectedUsers && request.affectedUsers > 100) score += 10;

    return Math.min(score, 100);
  }

  private canAutoApprove(request: any, riskScore: number): boolean {
    if (!this.config.autoApprovalEnabled) return false;
    if (riskScore > this.config.autoApprovalCriteria.maxRiskScore) return false;
    
    // Check if it's a trusted plugin
    const isTrustedPlugin = this.config.autoApprovalCriteria.trustedPlugins.includes(request.pluginId);
    const isTrustedAuthor = this.config.autoApprovalCriteria.trustedAuthors.some(author => 
      request.pluginId.startsWith(author)
    );

    if (!isTrustedPlugin && !isTrustedAuthor) return false;

    // Check environment
    if (request.environment === 'production') return false;
    if (!this.config.autoApprovalCriteria.nonProductionEnvironments && 
        request.environment !== 'development') return false;

    return true;
  }

  private async autoApprove(requestId: string, request: any): Promise<string> {
    const approvalRequest: ApprovalRequest = {
      ...request,
      id: requestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'approved',
      currentStep: 0,
      approvers: [{
        id: 'system',
        name: 'Auto Approval System',
        email: 'system@backstage.io',
        role: 'system',
        required: true,
        approved: true,
        approvedAt: new Date(),
        order: 0
      }],
      audit: [
        {
          timestamp: new Date(),
          action: 'request-submitted',
          actor: request.requesterId,
          details: `Submitted ${request.type} request for ${request.pluginId}`
        },
        {
          timestamp: new Date(),
          action: 'auto-approved',
          actor: 'system',
          details: 'Automatically approved based on risk assessment and trust criteria'
        }
      ]
    };

    this.approvalRequests.set(requestId, approvalRequest);
    this.emit('request-auto-approved', approvalRequest);
    
    // Execute the approved action immediately
    await this.executeApprovedAction(approvalRequest);
    
    return requestId;
  }

  private async processWorkflowStep(requestId: string): Promise<void> {
    const request = this.approvalRequests.get(requestId);
    if (!request) return;

    const workflow = this.workflows.get(request.workflow);
    if (!workflow) return;

    // Implementation would process the next step in the workflow
    request.status = 'in-review';
    request.updatedAt = new Date();
    this.approvalRequests.set(requestId, request);
  }

  private async executeApprovedAction(request: ApprovalRequest): Promise<void> {
    // This would integrate with the plugin installer/orchestrator
    console.log(`Executing approved action: ${request.type} for ${request.pluginId}`);
    
    request.audit.push({
      timestamp: new Date(),
      action: 'action-executed',
      actor: 'system',
      details: `Executed ${request.type} for ${request.pluginId}`
    });
  }

  private async sendNotifications(request: ApprovalRequest, event: string): Promise<void> {
    if (!this.config.notifications.enabled) return;

    // Implementation would send notifications via configured channels
    console.log(`Sending notification for ${event}: ${request.id}`);
  }

  private evaluateRuleConditions(rule: ComplianceRule, request: ApprovalRequest): boolean {
    return rule.conditions.some(condition => {
      const fieldValue = this.getFieldValue(request, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  private getFieldValue(request: ApprovalRequest, field: string): any {
    const fields: Record<string, any> = {
      'environment': request.environment,
      'type': request.type,
      'version': request.version,
      'pluginId': request.pluginId,
      'tenantId': request.tenantId,
      'priority': request.priority
    };
    return fields[field];
  }

  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals': return fieldValue === expectedValue;
      case 'not-equals': return fieldValue !== expectedValue;
      case 'contains': return String(fieldValue).includes(String(expectedValue));
      case 'not-contains': return !String(fieldValue).includes(String(expectedValue));
      case 'greater-than': return Number(fieldValue) > Number(expectedValue);
      case 'less-than': return Number(fieldValue) < Number(expectedValue);
      case 'regex': return new RegExp(expectedValue).test(String(fieldValue));
      default: return false;
    }
  }

  private generateRequestId(): string {
    return createHash('md5').update(`request-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 12);
  }

  private generateScanId(): string {
    return createHash('md5').update(`scan-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 12);
  }

  private async runDependencyScan(scanId: string): Promise<void> {
    // Mock dependency scan
    const scan = this.securityScans.get(scanId)!;
    
    // Simulate scan findings
    scan.findings.push({
      id: 'dep-001',
      severity: 'medium',
      type: 'vulnerability',
      title: 'Outdated dependency with known vulnerability',
      description: 'Package xyz@1.0.0 has a known security vulnerability',
      remediation: 'Update to xyz@1.2.3 or later',
      references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-12345'],
      cveId: 'CVE-2021-12345',
      cvssScore: 6.5,
      suppressed: false
    });

    this.securityScans.set(scanId, scan);
  }

  private async runCodeScan(scanId: string): Promise<void> {
    // Mock code scan
    const scan = this.securityScans.get(scanId)!;
    
    scan.findings.push({
      id: 'code-001',
      severity: 'low',
      type: 'best-practice',
      title: 'Unused import detected',
      description: 'Import statement is not used in the code',
      file: 'src/plugin.ts',
      line: 5,
      remediation: 'Remove unused import',
      references: [],
      suppressed: false
    });

    this.securityScans.set(scanId, scan);
  }

  private async runLicenseScan(scanId: string): Promise<void> {
    // Mock license scan
    const scan = this.securityScans.get(scanId)!;
    this.securityScans.set(scanId, scan);
  }

  private async runMalwareScan(scanId: string): Promise<void> {
    // Mock malware scan
    const scan = this.securityScans.get(scanId)!;
    this.securityScans.set(scanId, scan);
  }

  private calculateSecurityScore(findings: SecurityScan['findings']): number {
    let score = 100;
    
    for (const finding of findings) {
      if (finding.suppressed) continue;
      
      switch (finding.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
        case 'info': score -= 1; break;
      }
    }

    return Math.max(0, score);
  }

  private evaluateSecurityResults(scan: SecurityScan): boolean {
    const criticalFindings = scan.findings.filter(f => f.severity === 'critical' && !f.suppressed);
    const highFindings = scan.findings.filter(f => f.severity === 'high' && !f.suppressed);

    if (this.config.securityScanning.blockOnCriticalSeverity && criticalFindings.length > 0) {
      return false;
    }

    if (this.config.securityScanning.blockOnHighSeverity && highFindings.length > 0) {
      return false;
    }

    return scan.score >= 60; // Minimum acceptable score
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private startBackgroundTasks(): void {
    // Periodic cleanup of old requests and scans
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour

    // Check for expired requests
    setInterval(() => {
      this.handleExpiredRequests();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupOldData(): void {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

    // Clean up old requests
    for (const [id, request] of this.approvalRequests) {
      if (request.createdAt < cutoffDate && 
          (request.status === 'approved' || request.status === 'rejected')) {
        this.approvalRequests.delete(id);
      }
    }

    // Clean up old scans
    for (const [id, scan] of this.securityScans) {
      if (scan.startedAt < cutoffDate) {
        this.securityScans.delete(id);
      }
    }
  }

  private handleExpiredRequests(): void {
    for (const [id, request] of this.approvalRequests) {
      if (request.expiresAt && request.expiresAt < new Date() && 
          (request.status === 'pending' || request.status === 'in-review')) {
        request.status = 'expired';
        request.updatedAt = new Date();
        request.audit.push({
          timestamp: new Date(),
          action: 'expired',
          actor: 'system',
          details: 'Request expired due to timeout'
        });
        
        this.approvalRequests.set(id, request);
        this.emit('request-expired', request);
      }
    }
  }
}

// Export singleton instance
export const enterpriseGovernanceService = new EnterpriseGovernanceService();
export default EnterpriseGovernanceService;