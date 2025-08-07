/**
 * Vault Governance Manager with OPA Integration
 * Manages policy enforcement, compliance checking, and governance workflows
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { VaultApi } from './vault-client';

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  compliance: ComplianceMetadata;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface PolicyCondition {
  type: 'path' | 'user' | 'time' | 'operation' | 'data_classification' | 'risk_score';
  operator: 'equals' | 'starts_with' | 'contains' | 'in' | 'greater_than' | 'less_than';
  value: any;
  metadata?: Record<string, any>;
}

export interface PolicyAction {
  type: 'allow' | 'deny' | 'require_approval' | 'log' | 'alert' | 'encrypt' | 'redact';
  parameters?: Record<string, any>;
}

export interface ComplianceMetadata {
  regulations: string[];
  controls: string[];
  evidence_required: boolean;
  retention_period: number; // days
}

export interface PolicyDecision {
  allow: boolean;
  policy_id?: string;
  reason: string;
  risk_score: number;
  compliance_status: {
    violations: string[];
    warnings: string[];
  };
  required_actions: string[];
  metadata: Record<string, any>;
}

export interface GovernanceRequest {
  user: {
    id: string;
    name?: string;
    email?: string;
    roles: string[];
    groups: string[];
    attributes?: Record<string, any>;
  };
  resource: {
    path: string;
    type: 'secret' | 'policy' | 'auth' | 'mount';
    classification?: string;
    sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  };
  operation: {
    type: 'create' | 'read' | 'update' | 'delete' | 'list';
    method: string;
    parameters?: Record<string, any>;
  };
  context: {
    timestamp: Date;
    ip_address: string;
    user_agent?: string;
    session_id?: string;
    request_id: string;
    environment: 'development' | 'staging' | 'production';
  };
  justification?: string;
  emergency?: boolean;
}

export interface ApprovalWorkflow {
  id: string;
  request_id: string;
  type: 'emergency_access' | 'policy_exception' | 'privileged_operation';
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requester: string;
  approvers: string[];
  required_approvals: number;
  current_approvals: number;
  justification: string;
  expiry: Date;
  created_at: Date;
  approved_at?: Date;
  denied_at?: Date;
}

export interface ComplianceReport {
  id: string;
  period: { start: Date; end: Date };
  regulation: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  violations: ComplianceViolation[];
  recommendations: string[];
  generated_at: Date;
}

export interface ComplianceViolation {
  policy_id: string;
  resource_path: string;
  user_id: string;
  violation_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  occurred_at: Date;
  resolved: boolean;
  resolution_date?: Date;
}

/**
 * Advanced Governance Manager with OPA integration
 */
export class VaultGovernanceManager extends EventEmitter {
  private vaultApi: VaultApi;
  private opaClient: AxiosInstance;
  private policies: Map<string, GovernancePolicy> = new Map();
  private approvalWorkflows: Map<string, ApprovalWorkflow> = new Map();
  private decisionCache: Map<string, PolicyDecision> = new Map();
  private complianceViolations: ComplianceViolation[] = [];

  constructor(
    vaultApi: VaultApi,
    opaEndpoint: string = 'http://opa.opa-system.svc.cluster.local:8181'
  ) {
    super();
    this.vaultApi = vaultApi;
    this.opaClient = axios.create({
      baseURL: opaEndpoint,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.loadPolicies();
    this.startComplianceMonitoring();
  }

  /**
   * Evaluate governance policies for a request
   */
  async evaluateRequest(request: GovernanceRequest): Promise<PolicyDecision> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedDecision = this.decisionCache.get(cacheKey);
      
      if (cachedDecision && this.isCacheValid(cachedDecision)) {
        return cachedDecision;
      }

      // Evaluate with OPA
      const opaInput = this.transformToOpaInput(request);
      const opaResponse = await this.opaClient.post('/v1/data/vault/governance', {
        input: opaInput
      });

      const decision: PolicyDecision = {
        allow: opaResponse.data.result.allow || false,
        policy_id: opaResponse.data.result.policy_id,
        reason: opaResponse.data.result.deny_reason || 'Policy evaluation completed',
        risk_score: opaResponse.data.result.risk_score || 0,
        compliance_status: {
          violations: opaResponse.data.result.compliance_violations || [],
          warnings: opaResponse.data.result.compliance_warnings || []
        },
        required_actions: opaResponse.data.result.required_actions || [],
        metadata: opaResponse.data.result.policy_decision || {}
      };

      // Cache the decision
      this.decisionCache.set(cacheKey, {
        ...decision,
        metadata: { ...decision.metadata, cached_at: Date.now() }
      });

      // Handle compliance violations
      if (decision.compliance_status.violations.length > 0) {
        await this.handleComplianceViolations(request, decision);
      }

      // Emit decision event
      this.emit('policy_decision', { request, decision });

      return decision;
    } catch (error) {
      this.emit('policy_evaluation_failed', { request, error });
      
      // Fail-safe decision
      return {
        allow: false,
        reason: 'Policy evaluation failed - default deny',
        risk_score: 10,
        compliance_status: { violations: [], warnings: ['Policy evaluation error'] },
        required_actions: ['contact_administrator'],
        metadata: { error: (error as Error).message }
      };
    }
  }

  /**
   * Create approval workflow for policy exceptions
   */
  async createApprovalWorkflow(
    request: GovernanceRequest,
    type: ApprovalWorkflow['type'],
    justification: string,
    requiredApprovals: number = 1
  ): Promise<ApprovalWorkflow> {
    const workflow: ApprovalWorkflow = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      request_id: request.context.request_id,
      type,
      status: 'pending',
      requester: request.user.id,
      approvers: this.getRequiredApprovers(type, request),
      required_approvals: requiredApprovals,
      current_approvals: 0,
      justification,
      expiry: new Date(Date.now() + (type === 'emergency_access' ? 3600000 : 86400000)), // 1h or 24h
      created_at: new Date()
    };

    this.approvalWorkflows.set(workflow.id, workflow);
    
    // Notify approvers
    this.emit('approval_request_created', workflow);
    
    return workflow;
  }

  /**
   * Process approval for workflow
   */
  async processApproval(
    workflowId: string,
    approverId: string,
    approved: boolean,
    comments?: string
  ): Promise<ApprovalWorkflow> {
    const workflow = this.approvalWorkflows.get(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== 'pending') {
      throw new Error(`Workflow ${workflowId} is not in pending state`);
    }

    if (!workflow.approvers.includes(approverId)) {
      throw new Error(`User ${approverId} is not authorized to approve this workflow`);
    }

    if (approved) {
      workflow.current_approvals++;
      
      if (workflow.current_approvals >= workflow.required_approvals) {
        workflow.status = 'approved';
        workflow.approved_at = new Date();
        this.emit('workflow_approved', workflow);
      }
    } else {
      workflow.status = 'denied';
      workflow.denied_at = new Date();
      this.emit('workflow_denied', workflow);
    }

    this.approvalWorkflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Add or update governance policy
   */
  async addPolicy(policy: Omit<GovernancePolicy, 'createdAt' | 'updatedAt'>): Promise<void> {
    const fullPolicy: GovernancePolicy = {
      ...policy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate policy
    this.validatePolicy(fullPolicy);

    // Convert to OPA policy
    const opaPolicy = this.convertToOpaPolicy(fullPolicy);

    // Deploy to OPA
    await this.opaClient.put(`/v1/policies/${policy.id}`, opaPolicy);

    // Store locally
    this.policies.set(policy.id, fullPolicy);

    this.emit('policy_updated', fullPolicy);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    regulation: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const violations = this.complianceViolations.filter(v => 
      v.occurred_at >= startDate && 
      v.occurred_at <= endDate
    );

    const status: ComplianceReport['status'] = 
      violations.length === 0 ? 'compliant' :
      violations.some(v => v.severity === 'critical') ? 'non_compliant' :
      'partial';

    const recommendations = this.generateComplianceRecommendations(violations);

    const report: ComplianceReport = {
      id: `report-${regulation}-${Date.now()}`,
      period: { start: startDate, end: endDate },
      regulation,
      status,
      violations,
      recommendations,
      generated_at: new Date()
    };

    this.emit('compliance_report_generated', report);
    return report;
  }

  /**
   * Get policy decision metrics
   */
  getPolicyMetrics(): {
    total_decisions: number;
    allowed_decisions: number;
    denied_decisions: number;
    average_risk_score: number;
    compliance_violations: number;
    active_workflows: number;
  } {
    const decisions = Array.from(this.decisionCache.values());
    const activeWorkflows = Array.from(this.approvalWorkflows.values())
      .filter(w => w.status === 'pending');

    return {
      total_decisions: decisions.length,
      allowed_decisions: decisions.filter(d => d.allow).length,
      denied_decisions: decisions.filter(d => !d.allow).length,
      average_risk_score: decisions.reduce((sum, d) => sum + d.risk_score, 0) / Math.max(decisions.length, 1),
      compliance_violations: this.complianceViolations.filter(v => !v.resolved).length,
      active_workflows: activeWorkflows.length
    };
  }

  /**
   * Bulk policy evaluation for performance testing
   */
  async evaluateBatch(requests: GovernanceRequest[]): Promise<PolicyDecision[]> {
    const batchInput = requests.map(request => this.transformToOpaInput(request));
    
    try {
      const response = await this.opaClient.post('/v1/data/vault/governance/batch', {
        input: batchInput
      });

      return response.data.result.map((result: any, index: number) => ({
        allow: result.allow || false,
        policy_id: result.policy_id,
        reason: result.deny_reason || 'Policy evaluation completed',
        risk_score: result.risk_score || 0,
        compliance_status: {
          violations: result.compliance_violations || [],
          warnings: result.compliance_warnings || []
        },
        required_actions: result.required_actions || [],
        metadata: result.policy_decision || {}
      }));
    } catch (error) {
      // Return fail-safe decisions for all requests
      return requests.map(() => ({
        allow: false,
        reason: 'Batch evaluation failed - default deny',
        risk_score: 10,
        compliance_status: { violations: [], warnings: ['Batch evaluation error'] },
        required_actions: ['contact_administrator'],
        metadata: { error: (error as Error).message }
      }));
    }
  }

  private loadPolicies(): void {
    // Load default policies
    const defaultPolicies: Omit<GovernancePolicy, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'gdpr-personal-data',
        name: 'GDPR Personal Data Protection',
        description: 'Enforces GDPR compliance for personal data access',
        version: '1.0.0',
        enabled: true,
        priority: 100,
        conditions: [
          {
            type: 'path',
            operator: 'starts_with',
            value: 'secret/data/pii/'
          }
        ],
        actions: [
          { type: 'log' },
          { type: 'require_approval', parameters: { approvers: ['privacy-officer'] } }
        ],
        compliance: {
          regulations: ['GDPR'],
          controls: ['Art. 32', 'Art. 35'],
          evidence_required: true,
          retention_period: 2555 // 7 years
        },
        createdBy: 'system'
      },
      {
        id: 'privileged-access',
        name: 'Privileged Access Control',
        description: 'Controls access to privileged Vault operations',
        version: '1.0.0',
        enabled: true,
        priority: 200,
        conditions: [
          {
            type: 'operation',
            operator: 'in',
            value: ['delete', 'destroy', 'revoke']
          }
        ],
        actions: [
          { type: 'log' },
          { type: 'alert', parameters: { severity: 'high' } }
        ],
        compliance: {
          regulations: ['SOX', 'PCI-DSS'],
          controls: ['AC-6', 'AU-2'],
          evidence_required: true,
          retention_period: 2555
        },
        createdBy: 'system'
      }
    ];

    for (const policy of defaultPolicies) {
      this.addPolicy(policy);
    }
  }

  private startComplianceMonitoring(): void {
    // Monitor for expired workflows
    setInterval(() => {
      const now = new Date();
      
      for (const workflow of this.approvalWorkflows.values()) {
        if (workflow.status === 'pending' && workflow.expiry < now) {
          workflow.status = 'expired';
          this.emit('workflow_expired', workflow);
        }
      }
    }, 60000); // Check every minute

    // Clear old cache entries
    setInterval(() => {
      const now = Date.now();
      const maxAge = 300000; // 5 minutes
      
      for (const [key, decision] of this.decisionCache.entries()) {
        const cachedAt = decision.metadata.cached_at || 0;
        if (now - cachedAt > maxAge) {
          this.decisionCache.delete(key);
        }
      }
    }, 60000);
  }

  private transformToOpaInput(request: GovernanceRequest): any {
    return {
      user: {
        id: request.user.id,
        name: request.user.name,
        email: request.user.email,
        roles: request.user.roles,
        groups: request.user.groups,
        authenticated: true,
        account_locked: false,
        emergency_access: request.emergency || false,
        ...request.user.attributes
      },
      request: {
        path: request.resource.path,
        operation: request.operation.type,
        method: request.operation.method,
        data: request.operation.parameters,
        justification: request.justification
      },
      resource: {
        type: request.resource.type,
        classification: request.resource.classification,
        sensitivity: request.resource.sensitivity
      },
      context: {
        timestamp: request.context.timestamp.toISOString(),
        ip: request.context.ip_address,
        user_agent: request.context.user_agent,
        session_id: request.context.session_id,
        request_id: request.context.request_id,
        environment: request.context.environment
      },
      client: {
        ip: request.context.ip_address,
        user_agent: request.context.user_agent
      },
      auth: {
        policies: request.user.roles,
        issued_at: request.context.timestamp.toISOString()
      }
    };
  }

  private generateCacheKey(request: GovernanceRequest): string {
    const keyData = {
      user: request.user.id,
      path: request.resource.path,
      operation: request.operation.type,
      emergency: request.emergency || false
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private isCacheValid(decision: PolicyDecision): boolean {
    const cachedAt = decision.metadata.cached_at || 0;
    const maxAge = decision.allow ? 300000 : 60000; // 5 min for allow, 1 min for deny
    
    return (Date.now() - cachedAt) < maxAge;
  }

  private getRequiredApprovers(
    type: ApprovalWorkflow['type'],
    request: GovernanceRequest
  ): string[] {
    switch (type) {
      case 'emergency_access':
        return ['security-manager', 'ciso'];
      case 'policy_exception':
        return ['compliance-officer', 'security-manager'];
      case 'privileged_operation':
        return request.resource.sensitivity === 'restricted' 
          ? ['security-manager', 'cto']
          : ['security-manager'];
      default:
        return ['security-manager'];
    }
  }

  private validatePolicy(policy: GovernancePolicy): void {
    if (!policy.id || !policy.name) {
      throw new Error('Policy must have id and name');
    }

    if (!policy.conditions || policy.conditions.length === 0) {
      throw new Error('Policy must have at least one condition');
    }

    if (!policy.actions || policy.actions.length === 0) {
      throw new Error('Policy must have at least one action');
    }
  }

  private convertToOpaPolicy(policy: GovernancePolicy): string {
    // Convert governance policy to OPA Rego policy
    // This is a simplified conversion - in production, use a proper template engine
    return `
package vault.governance.${policy.id.replace(/-/g, '_')}

import rego.v1

# ${policy.description}
${policy.id.replace(/-/g, '_')}_allow if {
    ${policy.conditions.map(c => this.convertConditionToRego(c)).join('\n    ')}
}

${policy.actions.map(a => this.convertActionToRego(a, policy.id)).join('\n')}
`;
  }

  private convertConditionToRego(condition: PolicyCondition): string {
    switch (condition.type) {
      case 'path':
        if (condition.operator === 'starts_with') {
          return `startswith(input.request.path, "${condition.value}")`;
        }
        break;
      case 'operation':
        if (condition.operator === 'in') {
          const values = Array.isArray(condition.value) ? condition.value : [condition.value];
          return `input.request.operation in [${values.map(v => `"${v}"`).join(', ')}]`;
        }
        break;
    }
    return 'true  # condition not implemented';
  }

  private convertActionToRego(action: PolicyAction, policyId: string): string {
    switch (action.type) {
      case 'log':
        return `# Log action for policy ${policyId}`;
      case 'alert':
        return `# Alert action for policy ${policyId}`;
      default:
        return `# Action ${action.type} for policy ${policyId}`;
    }
  }

  private async handleComplianceViolations(
    request: GovernanceRequest,
    decision: PolicyDecision
  ): Promise<void> {
    for (const violationType of decision.compliance_status.violations) {
      const violation: ComplianceViolation = {
        policy_id: decision.policy_id || 'unknown',
        resource_path: request.resource.path,
        user_id: request.user.id,
        violation_type: violationType,
        severity: decision.risk_score > 7 ? 'critical' : decision.risk_score > 5 ? 'high' : 'medium',
        description: `Compliance violation: ${violationType}`,
        occurred_at: new Date(),
        resolved: false
      };

      this.complianceViolations.push(violation);
      this.emit('compliance_violation', violation);
    }
  }

  private generateComplianceRecommendations(violations: ComplianceViolation[]): string[] {
    const recommendations: string[] = [];
    
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;

    if (criticalCount > 0) {
      recommendations.push(`Address ${criticalCount} critical compliance violation(s) immediately`);
    }

    if (highCount > 0) {
      recommendations.push(`Review ${highCount} high-priority compliance issue(s) within 24 hours`);
    }

    const violationsByType = violations.reduce((acc, v) => {
      acc[v.violation_type] = (acc[v.violation_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [type, count] of Object.entries(violationsByType)) {
      if (count > 5) {
        recommendations.push(`Consider policy updates to prevent recurring ${type} violations (${count} occurrences)`);
      }
    }

    return recommendations;
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    this.removeAllListeners();
    this.decisionCache.clear();
    this.policies.clear();
    this.approvalWorkflows.clear();
  }
}

/**
 * Factory function to create a configured governance manager
 */
export function createVaultGovernanceManager(
  vaultApi: VaultApi,
  opaEndpoint?: string
): VaultGovernanceManager {
  return new VaultGovernanceManager(vaultApi, opaEndpoint);
}