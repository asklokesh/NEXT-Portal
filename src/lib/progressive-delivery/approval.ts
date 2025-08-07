import { EventEmitter } from 'events';
import { ProgressiveDeployment, DeploymentPhase, DeploymentApproval, ApprovalGate } from './types';

export class ApprovalWorkflow extends EventEmitter {
  private pendingApprovals = new Map<string, DeploymentApproval[]>();
  private approvalTimeouts = new Map<string, NodeJS.Timeout>();

  async configure(deployment: ProgressiveDeployment): Promise<void> {
    this.emit('approvalConfigured', { deployment });
  }

  async isApprovalNeeded(deployment: ProgressiveDeployment, phase: DeploymentPhase): Promise<boolean> {
    const { approval } = deployment.config;
    
    if (!approval.required) return false;
    
    // Check if this phase requires approval based on gates
    const phaseGate = approval.gates.find(gate => gate.name === phase.name);
    return phaseGate?.required || false;
  }

  async requestApproval(deployment: ProgressiveDeployment, phase: DeploymentPhase): Promise<void> {
    const approvals = deployment.config.approval.approvers.map(approver => ({
      id: `approval-${Date.now()}-${approver}`,
      deploymentId: deployment.id,
      phase: phase.name,
      approver,
      status: 'pending' as const,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.parseTimeout(deployment.config.approval.timeout))
    }));
    
    this.pendingApprovals.set(deployment.id, approvals);
    
    // Set timeout for approval
    const timeout = setTimeout(() => {
      this.expireApproval(deployment.id);
    }, this.parseTimeout(deployment.config.approval.timeout));
    
    this.approvalTimeouts.set(deployment.id, timeout);
    
    // Notify approvers
    await this.notifyApprovers(deployment, phase, approvals);
    
    this.emit('approvalRequested', { deployment, phase, approvals });
  }

  async approve(deploymentId: string, approver: string, reason?: string): Promise<void> {
    const approvals = this.pendingApprovals.get(deploymentId);
    if (!approvals) {
      throw new Error('No pending approvals found');
    }
    
    const approval = approvals.find(a => a.approver === approver && a.status === 'pending');
    if (!approval) {
      throw new Error('Approval not found or already processed');
    }
    
    approval.status = 'approved';
    approval.reason = reason;
    approval.timestamp = new Date();
    
    // Check if all required approvals are completed
    const allApproved = approvals.every(a => a.status === 'approved');
    
    if (allApproved) {
      this.clearApprovalTimeout(deploymentId);
      this.pendingApprovals.delete(deploymentId);
      this.emit('approved', { deploymentId, approvals });
    }
    
    this.emit('individualApproval', { deploymentId, approval });
  }

  async reject(deploymentId: string, approver: string, reason: string): Promise<void> {
    const approvals = this.pendingApprovals.get(deploymentId);
    if (!approvals) {
      throw new Error('No pending approvals found');
    }
    
    const approval = approvals.find(a => a.approver === approver && a.status === 'pending');
    if (!approval) {
      throw new Error('Approval not found or already processed');
    }
    
    approval.status = 'rejected';
    approval.reason = reason;
    approval.timestamp = new Date();
    
    this.clearApprovalTimeout(deploymentId);
    this.pendingApprovals.delete(deploymentId);
    
    this.emit('rejected', { deploymentId, approval, reason });
  }

  private async notifyApprovers(deployment: ProgressiveDeployment, phase: DeploymentPhase, approvals: DeploymentApproval[]): Promise<void> {
    // Send notifications to approvers (email, Slack, etc.)
    for (const approval of approvals) {
      await this.sendNotification(approval, deployment, phase);
    }
  }

  private async sendNotification(approval: DeploymentApproval, deployment: ProgressiveDeployment, phase: DeploymentPhase): Promise<void> {
    const message = {
      to: approval.approver,
      subject: `Deployment Approval Required: ${deployment.name}`,
      body: `
        Deployment ${deployment.name} requires your approval for phase ${phase.name}.
        
        Service: ${deployment.config.service.name}
        Version: ${deployment.config.service.version}
        Phase: ${phase.name}
        
        Please approve or reject this deployment in the portal.
      `
    };
    
    // Mock notification - would integrate with real notification system
    console.log('Sending notification:', message);
  }

  private expireApproval(deploymentId: string): void {
    const approvals = this.pendingApprovals.get(deploymentId);
    if (approvals) {
      approvals.forEach(approval => {
        if (approval.status === 'pending') {
          approval.status = 'expired';
          approval.timestamp = new Date();
        }
      });
      
      this.pendingApprovals.delete(deploymentId);
      this.emit('approvalExpired', { deploymentId, approvals });
    }
  }

  private clearApprovalTimeout(deploymentId: string): void {
    const timeout = this.approvalTimeouts.get(deploymentId);
    if (timeout) {
      clearTimeout(timeout);
      this.approvalTimeouts.delete(deploymentId);
    }
  }

  private parseTimeout(timeout: string): number {
    const match = timeout.match(/^(\d+)([smh])$/);
    if (!match) return 600000; // Default 10 minutes
    
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    
    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      default: return 600000;
    }
  }

  getPendingApprovals(deploymentId: string): DeploymentApproval[] {
    return this.pendingApprovals.get(deploymentId) || [];
  }

  cleanup(deploymentId: string): void {
    this.clearApprovalTimeout(deploymentId);
    this.pendingApprovals.delete(deploymentId);
  }
}