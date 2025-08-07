/**
 * Feature Flag Approval Workflow
 * Handles governance and approval processes for flag changes
 */

import { 
  FeatureFlagApproval, 
  ApprovalStatus, 
  FeatureFlagWorkflow,
  AutoApprovalRule,
  FeatureFlag 
} from './types';

export class ApprovalWorkflow {
  private approvals = new Map<string, FeatureFlagApproval>();
  private workflows = new Map<string, FeatureFlagWorkflow>();

  /**
   * Request approval for flag changes
   */
  async requestApproval(
    flagKey: string,
    requestedChanges: Partial<FeatureFlag>,
    requestedBy: string = 'system'
  ): Promise<FeatureFlagApproval> {
    const workflow = this.workflows.get('default') || this.getDefaultWorkflow();
    
    // Check if auto-approval rules apply
    const autoApprove = await this.checkAutoApprovalRules(
      flagKey,
      requestedChanges,
      workflow
    );

    const approval: FeatureFlagApproval = {
      id: this.generateId(),
      flagKey,
      requestedBy,
      status: autoApprove ? 'approved' : 'pending',
      requestedChanges,
      createdAt: new Date(),
      approvedAt: autoApprove ? new Date() : undefined,
      approvedBy: autoApprove ? 'auto-approval' : undefined,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.approvals.set(approval.id, approval);

    if (autoApprove) {
      await this.notifyApproval(approval, workflow);
    } else {
      await this.notifyApprovalRequest(approval, workflow);
    }

    return approval;
  }

  /**
   * Approve a pending request
   */
  async approveRequest(
    approvalId: string,
    approvedBy: string,
    reason?: string
  ): Promise<FeatureFlagApproval> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Cannot approve request with status: ${approval.status}`);
    }

    if (approval.expiresAt && approval.expiresAt < new Date()) {
      approval.status = 'expired';
      throw new Error('Approval request has expired');
    }

    approval.status = 'approved';
    approval.approvedBy = approvedBy;
    approval.approvedAt = new Date();
    approval.reason = reason;

    const workflow = this.workflows.get('default') || this.getDefaultWorkflow();
    await this.notifyApproval(approval, workflow);

    return approval;
  }

  /**
   * Reject a pending request
   */
  async rejectRequest(
    approvalId: string,
    rejectedBy: string,
    reason: string
  ): Promise<FeatureFlagApproval> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Cannot reject request with status: ${approval.status}`);
    }

    approval.status = 'rejected';
    approval.approvedBy = rejectedBy;
    approval.approvedAt = new Date();
    approval.reason = reason;

    const workflow = this.workflows.get('default') || this.getDefaultWorkflow();
    await this.notifyRejection(approval, workflow);

    return approval;
  }

  /**
   * Get approval by ID
   */
  async getApproval(approvalId: string): Promise<FeatureFlagApproval | null> {
    return this.approvals.get(approvalId) || null;
  }

  /**
   * List approvals with filtering
   */
  async listApprovals(filters: {
    flagKey?: string;
    status?: ApprovalStatus;
    requestedBy?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<FeatureFlagApproval[]> {
    let approvals = Array.from(this.approvals.values());

    if (filters.flagKey) {
      approvals = approvals.filter(a => a.flagKey === filters.flagKey);
    }

    if (filters.status) {
      approvals = approvals.filter(a => a.status === filters.status);
    }

    if (filters.requestedBy) {
      approvals = approvals.filter(a => a.requestedBy === filters.requestedBy);
    }

    // Sort by creation date (newest first)
    approvals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = filters.offset || 0;
    const limit = filters.limit || 50;

    return approvals.slice(offset, offset + limit);
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string): Promise<FeatureFlagApproval[]> {
    const workflow = this.workflows.get('default') || this.getDefaultWorkflow();
    
    if (!workflow.approvers.includes(userId)) {
      return [];
    }

    return Array.from(this.approvals.values())
      .filter(approval => 
        approval.status === 'pending' && 
        (!approval.expiresAt || approval.expiresAt > new Date())
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Create or update workflow configuration
   */
  async configureWorkflow(workflow: FeatureFlagWorkflow): Promise<void> {
    this.workflows.set(workflow.environment, workflow);
  }

  /**
   * Get workflow configuration
   */
  async getWorkflow(environment: string = 'default'): Promise<FeatureFlagWorkflow | null> {
    return this.workflows.get(environment) || null;
  }

  /**
   * Check if approval is required for changes
   */
  isApprovalRequired(
    changes: Partial<FeatureFlag>,
    environment: string = 'default'
  ): boolean {
    const workflow = this.workflows.get(environment);
    
    if (!workflow || !workflow.approvalRequired) {
      return false;
    }

    // Define fields that require approval
    const criticalFields = [
      'enabled',
      'rollout',
      'targeting',
      'variations'
    ];

    return criticalFields.some(field => field in changes);
  }

  /**
   * Cleanup expired approvals
   */
  async cleanupExpiredApprovals(): Promise<number> {
    let cleanupCount = 0;
    const now = new Date();

    for (const [id, approval] of this.approvals.entries()) {
      if (approval.status === 'pending' && 
          approval.expiresAt && 
          approval.expiresAt < now) {
        approval.status = 'expired';
        cleanupCount++;
      }
    }

    return cleanupCount;
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(timeRange?: { start: Date; end: Date }): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    averageApprovalTime: number; // in minutes
    topApprovers: { userId: string; count: number }[];
  }> {
    let approvals = Array.from(this.approvals.values());

    if (timeRange) {
      approvals = approvals.filter(a =>
        a.createdAt >= timeRange.start && a.createdAt <= timeRange.end
      );
    }

    const stats = {
      total: approvals.length,
      pending: approvals.filter(a => a.status === 'pending').length,
      approved: approvals.filter(a => a.status === 'approved').length,
      rejected: approvals.filter(a => a.status === 'rejected').length,
      expired: approvals.filter(a => a.status === 'expired').length,
      averageApprovalTime: 0,
      topApprovers: [] as { userId: string; count: number }[]
    };

    // Calculate average approval time
    const completedApprovals = approvals.filter(a => 
      a.status === 'approved' && a.approvedAt
    );

    if (completedApprovals.length > 0) {
      const totalApprovalTime = completedApprovals.reduce((sum, approval) => {
        const timeDiff = approval.approvedAt!.getTime() - approval.createdAt.getTime();
        return sum + (timeDiff / (1000 * 60)); // Convert to minutes
      }, 0);

      stats.averageApprovalTime = totalApprovalTime / completedApprovals.length;
    }

    // Calculate top approvers
    const approverCounts = new Map<string, number>();
    
    approvals
      .filter(a => a.status === 'approved' && a.approvedBy && a.approvedBy !== 'auto-approval')
      .forEach(approval => {
        const count = approverCounts.get(approval.approvedBy!) || 0;
        approverCounts.set(approval.approvedBy!, count + 1);
      });

    stats.topApprovers = Array.from(approverCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  // Private helper methods

  private async checkAutoApprovalRules(
    flagKey: string,
    changes: Partial<FeatureFlag>,
    workflow: FeatureFlagWorkflow
  ): Promise<boolean> {
    if (!workflow.autoApproveRules?.length) {
      return false;
    }

    for (const rule of workflow.autoApproveRules) {
      if (await this.evaluateAutoApprovalRule(flagKey, changes, rule)) {
        return true;
      }
    }

    return false;
  }

  private async evaluateAutoApprovalRule(
    flagKey: string,
    changes: Partial<FeatureFlag>,
    rule: AutoApprovalRule
  ): Promise<boolean> {
    switch (rule.condition) {
      case 'flag_prefix':
        return flagKey.startsWith(rule.value as string);
      
      case 'small_percentage_change':
        if (changes.rollout?.percentage !== undefined) {
          return changes.rollout.percentage <= (rule.value as number);
        }
        break;
      
      case 'disable_only':
        return changes.enabled === false && Object.keys(changes).length === 1;
      
      case 'tag_based':
        // Would need to load current flag to check tags
        return false;
      
      default:
        return false;
    }

    return false;
  }

  private async notifyApprovalRequest(
    approval: FeatureFlagApproval,
    workflow: FeatureFlagWorkflow
  ): Promise<void> {
    // In production, send notifications via configured channels
    console.log(`Approval requested for flag: ${approval.flagKey}`);
    console.log(`Notifying approvers:`, workflow.approvers);
    
    // Send notifications via:
    // - Email
    // - Slack/Teams
    // - In-app notifications
    // - Webhook
  }

  private async notifyApproval(
    approval: FeatureFlagApproval,
    workflow: FeatureFlagWorkflow
  ): Promise<void> {
    console.log(`Flag change approved: ${approval.flagKey} by ${approval.approvedBy}`);
    
    // Notify stakeholders about approval
    // Apply the changes automatically if configured
  }

  private async notifyRejection(
    approval: FeatureFlagApproval,
    workflow: FeatureFlagWorkflow
  ): Promise<void> {
    console.log(`Flag change rejected: ${approval.flagKey} by ${approval.approvedBy}`);
    console.log(`Reason: ${approval.reason}`);
    
    // Notify requester about rejection
  }

  private getDefaultWorkflow(): FeatureFlagWorkflow {
    return {
      id: 'default',
      name: 'Default Workflow',
      environment: 'default',
      approvalRequired: true,
      approvers: ['admin'],
      autoApproveRules: [
        {
          condition: 'small_percentage_change',
          value: 5,
          operator: 'lte'
        },
        {
          condition: 'disable_only',
          value: true,
          operator: 'eq'
        }
      ],
      notificationChannels: ['email', 'slack']
    };
  }

  private generateId(): string {
    return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}