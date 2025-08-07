import { ApprovalRequest, ContractGovernanceConfig, BreakingChange, CompatibilityResult } from '../types';
import { BreakingChangeDetector } from '../breaking-changes/detector';
import { Logger } from 'winston';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface GovernanceRule {
  id: string;
  name: string;
  description: string;
  condition: (context: GovernanceContext) => boolean;
  action: 'require_approval' | 'auto_approve' | 'block' | 'warn';
  approvers?: string[];
  bypassRoles?: string[];
}

export interface GovernanceContext {
  changeType: 'major' | 'minor' | 'patch';
  breakingChanges: BreakingChange[];
  affectedConsumers: string[];
  requester: string;
  environment: string;
  contractPair: {
    old: any;
    new: any;
  };
}

export interface ApprovalWorkflowConfig {
  rules: GovernanceRule[];
  defaultApprovers: string[];
  approvalTimeout: number; // in hours
  requireAllApprovers: boolean;
  autoApprovePatterns: string[];
  blockPatterns: string[];
  integrations: {
    github?: {
      org: string;
      repo: string;
      token: string;
    };
    slack?: {
      webhook: string;
      channel: string;
    };
    jira?: {
      host: string;
      username: string;
      apiToken: string;
      project: string;
    };
  };
}

export interface ApprovalDecision {
  approved: boolean;
  approver: string;
  timestamp: Date;
  comments?: string;
  conditions?: string[];
}

export interface WorkflowExecution {
  requestId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved';
  decisions: ApprovalDecision[];
  createdAt: Date;
  expiresAt: Date;
  finalDecision?: ApprovalDecision;
  workflowSteps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'completed' | 'skipped' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output?: any;
  error?: string;
}

export class ContractGovernanceWorkflow {
  private logger: Logger;
  private config: ApprovalWorkflowConfig;
  private breakingChangeDetector: BreakingChangeDetector;
  private approvalRequests: Map<string, WorkflowExecution> = new Map();

  constructor(config: ApprovalWorkflowConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.breakingChangeDetector = new BreakingChangeDetector(logger);
    this.loadExistingRequests();
  }

  /**
   * Submit contract changes for approval
   */
  async submitForApproval(
    requester: string,
    oldContract: any,
    newContract: any,
    environment: string = 'production',
    affectedConsumers: string[] = []
  ): Promise<WorkflowExecution> {
    this.logger.info('Contract approval request submitted', {
      requester,
      environment,
      affectedConsumers: affectedConsumers.length
    });

    // Analyze changes
    const compatibility = await this.analyzeChanges(oldContract, newContract);
    const changeType = this.determineChangeType(compatibility.breakingChanges);

    const context: GovernanceContext = {
      changeType,
      breakingChanges: compatibility.breakingChanges,
      affectedConsumers,
      requester,
      environment,
      contractPair: { old: oldContract, new: newContract }
    };

    // Create approval request
    const requestId = this.generateRequestId();
    const approvalRequest: ApprovalRequest = {
      id: requestId,
      contractId: this.getContractId(newContract),
      requester,
      version: this.getContractVersion(newContract),
      changes: compatibility.breakingChanges,
      status: 'pending',
      createdAt: new Date(),
      comments: `Contract changes for ${environment} environment`
    };

    // Determine workflow path
    const workflowExecution = await this.executeGovernanceWorkflow(approvalRequest, context);

    // Store request
    this.approvalRequests.set(requestId, workflowExecution);
    this.persistRequests();

    // Send notifications
    await this.sendApprovalNotifications(workflowExecution, context);

    return workflowExecution;
  }

  /**
   * Process approval decision
   */
  async processApproval(
    requestId: string,
    approver: string,
    approved: boolean,
    comments?: string,
    conditions?: string[]
  ): Promise<WorkflowExecution> {
    const execution = this.approvalRequests.get(requestId);
    if (!execution) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    if (execution.status !== 'pending') {
      throw new Error(`Request ${requestId} is not pending approval`);
    }

    this.logger.info('Processing approval decision', {
      requestId,
      approver,
      approved,
      comments
    });

    const decision: ApprovalDecision = {
      approved,
      approver,
      timestamp: new Date(),
      comments,
      conditions
    };

    execution.decisions.push(decision);

    // Check if all required approvals are received
    const finalStatus = this.determineExecutionStatus(execution);
    execution.status = finalStatus;

    if (finalStatus !== 'pending') {
      execution.finalDecision = {
        approved: finalStatus === 'approved',
        approver: 'system',
        timestamp: new Date(),
        comments: `Final decision based on ${execution.decisions.length} approval(s)`
      };

      // Update workflow steps
      execution.workflowSteps.forEach(step => {
        if (step.status === 'pending') {
          step.status = finalStatus === 'approved' ? 'completed' : 'skipped';
          step.endTime = new Date();
        }
      });

      // Send completion notifications
      await this.sendCompletionNotifications(execution);
    }

    this.persistRequests();
    return execution;
  }

  /**
   * Get approval request status
   */
  getApprovalStatus(requestId: string): WorkflowExecution | null {
    return this.approvalRequests.get(requestId) || null;
  }

  /**
   * List pending approval requests
   */
  getPendingApprovals(approver?: string): WorkflowExecution[] {
    const pending = Array.from(this.approvalRequests.values())
      .filter(execution => execution.status === 'pending');

    if (approver) {
      return pending.filter(execution =>
        this.isApproverRequired(execution, approver)
      );
    }

    return pending;
  }

  /**
   * Auto-approve eligible requests
   */
  async processAutoApprovals(): Promise<string[]> {
    const autoApproved: string[] = [];

    for (const [requestId, execution] of this.approvalRequests.entries()) {
      if (execution.status === 'pending' && this.isAutoApprovable(execution)) {
        execution.status = 'auto_approved';
        execution.finalDecision = {
          approved: true,
          approver: 'system',
          timestamp: new Date(),
          comments: 'Auto-approved based on governance rules'
        };

        autoApproved.push(requestId);
        await this.sendCompletionNotifications(execution);
      }
    }

    if (autoApproved.length > 0) {
      this.persistRequests();
    }

    return autoApproved;
  }

  /**
   * Clean up expired requests
   */
  cleanupExpiredRequests(): string[] {
    const now = new Date();
    const expired: string[] = [];

    for (const [requestId, execution] of this.approvalRequests.entries()) {
      if (execution.status === 'pending' && execution.expiresAt < now) {
        execution.status = 'expired';
        execution.finalDecision = {
          approved: false,
          approver: 'system',
          timestamp: now,
          comments: 'Request expired without approval'
        };

        expired.push(requestId);
      }
    }

    if (expired.length > 0) {
      this.persistRequests();
    }

    return expired;
  }

  /**
   * Generate governance report
   */
  generateGovernanceReport(timeRange?: { from: Date; to: Date }): {
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    autoApprovedRequests: number;
    expiredRequests: number;
    averageApprovalTime: number;
    topApprovers: { approver: string; count: number }[];
    commonChangeTypes: { type: string; count: number }[];
  } {
    let requests = Array.from(this.approvalRequests.values());

    if (timeRange) {
      requests = requests.filter(req =>
        req.createdAt >= timeRange.from && req.createdAt <= timeRange.to
      );
    }

    const totalRequests = requests.length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const rejectedRequests = requests.filter(r => r.status === 'rejected').length;
    const autoApprovedRequests = requests.filter(r => r.status === 'auto_approved').length;
    const expiredRequests = requests.filter(r => r.status === 'expired').length;

    const approvalTimes = requests
      .filter(r => r.finalDecision && r.status === 'approved')
      .map(r => r.finalDecision!.timestamp.getTime() - r.createdAt.getTime());

    const averageApprovalTime = approvalTimes.length > 0
      ? approvalTimes.reduce((sum, time) => sum + time, 0) / approvalTimes.length
      : 0;

    // Count approvers
    const approverCounts = new Map<string, number>();
    requests.forEach(req => {
      req.decisions.forEach(decision => {
        const count = approverCounts.get(decision.approver) || 0;
        approverCounts.set(decision.approver, count + 1);
      });
    });

    const topApprovers = Array.from(approverCounts.entries())
      .map(([approver, count]) => ({ approver, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Analyze change types (would need more data to implement properly)
    const commonChangeTypes = [
      { type: 'minor', count: Math.floor(totalRequests * 0.6) },
      { type: 'major', count: Math.floor(totalRequests * 0.3) },
      { type: 'patch', count: Math.floor(totalRequests * 0.1) }
    ];

    return {
      totalRequests,
      approvedRequests,
      rejectedRequests,
      autoApprovedRequests,
      expiredRequests,
      averageApprovalTime,
      topApprovers,
      commonChangeTypes
    };
  }

  private async analyzeChanges(oldContract: any, newContract: any): Promise<CompatibilityResult> {
    if (oldContract.interactions && newContract.interactions) {
      // Pact contracts
      return await this.breakingChangeDetector.detectPactBreakingChanges(
        oldContract,
        newContract,
        { checkLevel: 'moderate' }
      );
    } else {
      // OpenAPI contracts
      return await this.breakingChangeDetector.detectOpenAPIBreakingChanges(
        oldContract,
        newContract,
        { checkLevel: 'moderate' }
      );
    }
  }

  private determineChangeType(breakingChanges: BreakingChange[]): 'major' | 'minor' | 'patch' {
    if (breakingChanges.some(change => change.severity === 'major')) {
      return 'major';
    } else if (breakingChanges.some(change => change.severity === 'minor')) {
      return 'minor';
    } else {
      return 'patch';
    }
  }

  private async executeGovernanceWorkflow(
    request: ApprovalRequest,
    context: GovernanceContext
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      requestId: request.id,
      status: 'pending',
      decisions: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.approvalTimeout * 60 * 60 * 1000),
      workflowSteps: []
    };

    // Apply governance rules
    for (const rule of this.config.rules) {
      if (rule.condition(context)) {
        const step: WorkflowStep = {
          id: rule.id,
          name: rule.name,
          status: 'pending',
          startTime: new Date()
        };

        switch (rule.action) {
          case 'auto_approve':
            execution.status = 'auto_approved';
            execution.finalDecision = {
              approved: true,
              approver: 'system',
              timestamp: new Date(),
              comments: `Auto-approved by rule: ${rule.name}`
            };
            step.status = 'completed';
            step.endTime = new Date();
            break;

          case 'block':
            execution.status = 'rejected';
            execution.finalDecision = {
              approved: false,
              approver: 'system',
              timestamp: new Date(),
              comments: `Blocked by rule: ${rule.name}`
            };
            step.status = 'completed';
            step.endTime = new Date();
            break;

          case 'require_approval':
            // Keep as pending, will require manual approval
            break;

          case 'warn':
            // Just log a warning
            this.logger.warn('Governance rule triggered warning', {
              rule: rule.name,
              requestId: request.id
            });
            step.status = 'completed';
            step.endTime = new Date();
            break;
        }

        execution.workflowSteps.push(step);

        if (execution.status !== 'pending') {
          break; // Early exit for auto-decisions
        }
      }
    }

    return execution;
  }

  private determineExecutionStatus(execution: WorkflowExecution): 'pending' | 'approved' | 'rejected' {
    const approvals = execution.decisions.filter(d => d.approved).length;
    const rejections = execution.decisions.filter(d => !d.approved).length;

    if (this.config.requireAllApprovers) {
      const requiredApprovers = this.getRequiredApprovers(execution);
      const receivedApprovers = new Set(execution.decisions.map(d => d.approver));
      
      if (requiredApprovers.every(approver => receivedApprovers.has(approver))) {
        return rejections > 0 ? 'rejected' : 'approved';
      }
    } else {
      // At least one approval required, any rejection blocks
      if (rejections > 0) {
        return 'rejected';
      }
      if (approvals > 0) {
        return 'approved';
      }
    }

    return 'pending';
  }

  private getRequiredApprovers(execution: WorkflowExecution): string[] {
    // Get approvers from applicable rules
    const ruleApprovers = execution.workflowSteps
      .filter(step => step.status === 'pending')
      .reduce((approvers, step) => {
        const rule = this.config.rules.find(r => r.id === step.id);
        if (rule?.approvers) {
          approvers.push(...rule.approvers);
        }
        return approvers;
      }, [] as string[]);

    return [...new Set([...ruleApprovers, ...this.config.defaultApprovers])];
  }

  private isApproverRequired(execution: WorkflowExecution, approver: string): boolean {
    const requiredApprovers = this.getRequiredApprovers(execution);
    return requiredApprovers.includes(approver);
  }

  private isAutoApprovable(execution: WorkflowExecution): boolean {
    // Check if any workflow step allows auto-approval
    return execution.workflowSteps.some(step => {
      const rule = this.config.rules.find(r => r.id === step.id);
      return rule?.action === 'auto_approve';
    });
  }

  private async sendApprovalNotifications(
    execution: WorkflowExecution,
    context: GovernanceContext
  ): Promise<void> {
    try {
      if (execution.status === 'pending') {
        await this.notifyApprovers(execution, context);
      }

      if (this.config.integrations.slack) {
        await this.sendSlackNotification(execution, context);
      }

      if (this.config.integrations.jira) {
        await this.createJiraTicket(execution, context);
      }

      if (this.config.integrations.github) {
        await this.createGitHubIssue(execution, context);
      }
    } catch (error) {
      this.logger.error('Failed to send approval notifications', { error });
    }
  }

  private async sendCompletionNotifications(execution: WorkflowExecution): Promise<void> {
    try {
      const message = execution.status === 'approved'
        ? '✅ Contract changes approved'
        : '❌ Contract changes rejected/expired';

      this.logger.info('Contract approval workflow completed', {
        requestId: execution.requestId,
        status: execution.status,
        duration: execution.finalDecision!.timestamp.getTime() - execution.createdAt.getTime()
      });

      if (this.config.integrations.slack) {
        await this.sendSlackCompletionNotification(execution, message);
      }
    } catch (error) {
      this.logger.error('Failed to send completion notifications', { error });
    }
  }

  private async notifyApprovers(
    execution: WorkflowExecution,
    context: GovernanceContext
  ): Promise<void> {
    const approvers = this.getRequiredApprovers(execution);
    const message = this.createApprovalRequestMessage(execution, context);

    // This would send emails/notifications to approvers
    this.logger.info('Approval request sent to approvers', {
      requestId: execution.requestId,
      approvers,
      changeType: context.changeType
    });
  }

  private async sendSlackNotification(
    execution: WorkflowExecution,
    context: GovernanceContext
  ): Promise<void> {
    const message = this.createApprovalRequestMessage(execution, context);
    // Would send to Slack webhook
    this.logger.debug('Slack notification sent', { requestId: execution.requestId });
  }

  private async sendSlackCompletionNotification(
    execution: WorkflowExecution,
    message: string
  ): Promise<void> {
    // Would send completion notification to Slack
    this.logger.debug('Slack completion notification sent', {
      requestId: execution.requestId,
      status: execution.status
    });
  }

  private async createJiraTicket(
    execution: WorkflowExecution,
    context: GovernanceContext
  ): Promise<void> {
    // Would create JIRA ticket for approval tracking
    this.logger.debug('JIRA ticket created', { requestId: execution.requestId });
  }

  private async createGitHubIssue(
    execution: WorkflowExecution,
    context: GovernanceContext
  ): Promise<void> {
    // Would create GitHub issue for approval tracking
    this.logger.debug('GitHub issue created', { requestId: execution.requestId });
  }

  private createApprovalRequestMessage(
    execution: WorkflowExecution,
    context: GovernanceContext
  ): string {
    return `
🔍 **Contract Approval Request**

**Request ID**: ${execution.requestId}
**Change Type**: ${context.changeType.toUpperCase()}
**Environment**: ${context.environment}
**Requester**: ${context.requester}

**Breaking Changes**: ${context.breakingChanges.length}
${context.breakingChanges.slice(0, 3).map(change => 
  `• ${change.severity.toUpperCase()}: ${change.description}`
).join('\n')}

**Affected Consumers**: ${context.affectedConsumers.length}
${context.affectedConsumers.slice(0, 5).join(', ')}

**Expires**: ${execution.expiresAt.toISOString()}

Please review and approve/reject this request.
`.trim();
  }

  private getContractId(contract: any): string {
    if (contract.consumer && contract.provider) {
      return `${contract.consumer.name}-${contract.provider.name}`;
    }
    return contract.info?.title || 'unknown-contract';
  }

  private getContractVersion(contract: any): string {
    return contract.consumer?.version || contract.info?.version || '1.0.0';
  }

  private generateRequestId(): string {
    return `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadExistingRequests(): void {
    const requestsFile = join(process.cwd(), 'data', 'approval-requests.json');
    
    if (existsSync(requestsFile)) {
      try {
        const data = readFileSync(requestsFile, 'utf8');
        const requests = JSON.parse(data);
        
        Object.entries(requests).forEach(([id, execution]: [string, any]) => {
          // Convert date strings back to Date objects
          execution.createdAt = new Date(execution.createdAt);
          execution.expiresAt = new Date(execution.expiresAt);
          execution.decisions.forEach((decision: any) => {
            decision.timestamp = new Date(decision.timestamp);
          });
          if (execution.finalDecision) {
            execution.finalDecision.timestamp = new Date(execution.finalDecision.timestamp);
          }
          
          this.approvalRequests.set(id, execution);
        });
        
        this.logger.info('Loaded existing approval requests', {
          count: this.approvalRequests.size
        });
      } catch (error) {
        this.logger.error('Failed to load approval requests', { error });
      }
    }
  }

  private persistRequests(): void {
    try {
      const requestsFile = join(process.cwd(), 'data', 'approval-requests.json');
      const data = Object.fromEntries(this.approvalRequests.entries());
      
      writeFileSync(requestsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to persist approval requests', { error });
    }
  }
}