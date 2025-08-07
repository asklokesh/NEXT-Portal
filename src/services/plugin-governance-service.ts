/**
 * Plugin Governance Service
 * Manages plugin approval workflows, security policies, and compliance
 */

import { z } from 'zod';

interface GovernancePolicy {
  id: string;
  name: string;
  type: 'installation' | 'update' | 'security' | 'license' | 'resource';
  rules: PolicyRule[];
  enforcementLevel: 'strict' | 'warning' | 'advisory';
  exemptions: string[];
  approvers: string[];
  active: boolean;
}

interface PolicyRule {
  condition: string;
  value: any;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'regex';
  action: 'allow' | 'deny' | 'require-approval';
  message?: string;
}

interface GovernanceCheck {
  approved: boolean;
  reason?: string;
  requiredApprovals?: string[];
  policyViolations?: PolicyViolation[];
  riskScore?: number;
}

interface PolicyViolation {
  policyId: string;
  policyName: string;
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

interface ComplianceReport {
  timestamp: Date;
  totalPlugins: number;
  compliantPlugins: number;
  nonCompliantPlugins: number;
  violations: PolicyViolation[];
  riskScore: number;
  recommendations: string[];
}

interface PluginGovernanceStatus {
  pluginId: string;
  compliant: boolean;
  approvalStatus: 'approved' | 'pending' | 'rejected' | 'not-required';
  securityScore: number;
  licenseCompliant: boolean;
  resourceCompliant: boolean;
  lastAudit: Date;
  violations: PolicyViolation[];
}

interface SecurityScan {
  pluginId: string;
  version: string;
  scanDate: Date;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  dependencies: {
    total: number;
    outdated: number;
    vulnerable: number;
  };
  licenses: string[];
  cveList: string[];
}

export class PluginGovernanceService {
  private policies: Map<string, GovernancePolicy> = new Map();
  private approvals: Map<string, ApprovalRequest> = new Map();
  private auditLog: AuditEntry[] = [];
  private securityScans: Map<string, SecurityScan> = new Map();
  private resourceQuotas: Map<string, ResourceQuota> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Check if plugin installation is allowed by governance policies
   */
  async checkInstallationPolicy(
    pluginId: string,
    version?: string
  ): Promise<GovernanceCheck> {
    const violations: PolicyViolation[] = [];
    let requiresApproval = false;
    const requiredApprovals: string[] = [];

    // Check security policies
    const securityCheck = await this.checkSecurityPolicy(pluginId, version);
    if (!securityCheck.passed) {
      violations.push(...securityCheck.violations);
      if (securityCheck.requiresApproval) {
        requiresApproval = true;
        requiredApprovals.push(...securityCheck.approvers);
      }
    }

    // Check license policies
    const licenseCheck = await this.checkLicensePolicy(pluginId, version);
    if (!licenseCheck.passed) {
      violations.push(...licenseCheck.violations);
      if (licenseCheck.requiresApproval) {
        requiresApproval = true;
        requiredApprovals.push(...licenseCheck.approvers);
      }
    }

    // Check resource policies
    const resourceCheck = await this.checkResourcePolicy(pluginId);
    if (!resourceCheck.passed) {
      violations.push(...resourceCheck.violations);
    }

    // Check if plugin is on allowlist/blocklist
    const allowlistCheck = this.checkAllowlist(pluginId);
    if (!allowlistCheck.passed) {
      violations.push({
        policyId: 'allowlist',
        policyName: 'Plugin Allowlist',
        rule: 'allowlist-check',
        severity: 'critical',
        message: allowlistCheck.message || 'Plugin not on allowlist'
      });
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(violations);

    // Log governance check
    this.auditLog.push({
      timestamp: new Date(),
      action: 'installation-check',
      pluginId,
      version,
      result: violations.length === 0 ? 'approved' : requiresApproval ? 'requires-approval' : 'denied',
      violations,
      riskScore
    });

    // Create approval request if needed
    if (requiresApproval && violations.length > 0) {
      const approvalId = await this.createApprovalRequest({
        pluginId,
        version,
        requestType: 'installation',
        violations,
        requiredApprovals: [...new Set(requiredApprovals)],
        riskScore
      });

      return {
        approved: false,
        reason: 'Requires approval due to policy violations',
        requiredApprovals: [...new Set(requiredApprovals)],
        policyViolations: violations,
        riskScore
      };
    }

    return {
      approved: violations.length === 0,
      reason: violations.length > 0 ? 'Policy violations detected' : undefined,
      policyViolations: violations.length > 0 ? violations : undefined,
      riskScore
    };
  }

  /**
   * Check if plugin update is allowed
   */
  async checkUpdatePolicy(
    pluginId: string,
    targetVersion: string
  ): Promise<GovernanceCheck> {
    // Similar to installation but with additional checks for breaking changes
    const installCheck = await this.checkInstallationPolicy(pluginId, targetVersion);
    
    // Additional update-specific checks
    const updateViolations: PolicyViolation[] = [];

    // Check if downgrade is allowed
    const currentVersion = await this.getCurrentVersion(pluginId);
    if (currentVersion && this.isDowngrade(currentVersion, targetVersion)) {
      const downgradePolicy = this.policies.get('no-downgrades');
      if (downgradePolicy?.active) {
        updateViolations.push({
          policyId: 'no-downgrades',
          policyName: 'No Downgrades Policy',
          rule: 'version-check',
          severity: 'high',
          message: 'Downgrades are not allowed by policy'
        });
      }
    }

    // Check update frequency limits
    const lastUpdate = await this.getLastUpdateTime(pluginId);
    if (lastUpdate) {
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        updateViolations.push({
          policyId: 'update-frequency',
          policyName: 'Update Frequency Limit',
          rule: 'time-check',
          severity: 'low',
          message: 'Updates should be at least 24 hours apart'
        });
      }
    }

    const allViolations = [
      ...(installCheck.policyViolations || []),
      ...updateViolations
    ];

    return {
      approved: allViolations.length === 0,
      reason: allViolations.length > 0 ? 'Update policy violations' : undefined,
      policyViolations: allViolations.length > 0 ? allViolations : undefined,
      riskScore: this.calculateRiskScore(allViolations)
    };
  }

  /**
   * Get plugin governance status
   */
  async getPluginGovernanceStatus(pluginId: string): Promise<PluginGovernanceStatus> {
    const violations: PolicyViolation[] = [];
    
    // Check all applicable policies
    const securityCheck = await this.checkSecurityPolicy(pluginId);
    const licenseCheck = await this.checkLicensePolicy(pluginId);
    const resourceCheck = await this.checkResourcePolicy(pluginId);

    violations.push(
      ...securityCheck.violations,
      ...licenseCheck.violations,
      ...resourceCheck.violations
    );

    // Get approval status
    const approvalStatus = await this.getApprovalStatus(pluginId);

    // Get security score
    const securityScan = this.securityScans.get(pluginId);
    const securityScore = securityScan ? this.calculateSecurityScore(securityScan) : 0;

    return {
      pluginId,
      compliant: violations.length === 0,
      approvalStatus,
      securityScore,
      licenseCompliant: licenseCheck.passed,
      resourceCompliant: resourceCheck.passed,
      lastAudit: new Date(),
      violations
    };
  }

  /**
   * Generate compliance report
   */
  async getComplianceReport(): Promise<ComplianceReport> {
    const plugins = await this.getAllPlugins();
    const violations: PolicyViolation[] = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;

    for (const pluginId of plugins) {
      const status = await this.getPluginGovernanceStatus(pluginId);
      if (status.compliant) {
        compliantCount++;
      } else {
        nonCompliantCount++;
        violations.push(...status.violations);
      }
    }

    const riskScore = this.calculateOverallRiskScore(violations);
    const recommendations = this.generateRecommendations(violations);

    return {
      timestamp: new Date(),
      totalPlugins: plugins.length,
      compliantPlugins: compliantCount,
      nonCompliantPlugins: nonCompliantCount,
      violations,
      riskScore,
      recommendations
    };
  }

  /**
   * Perform security scan on plugin
   */
  async performSecurityScan(pluginId: string, version: string): Promise<SecurityScan> {
    // In production, integrate with security scanning tools (Snyk, Sonarqube, etc.)
    const scan: SecurityScan = {
      pluginId,
      version,
      scanDate: new Date(),
      vulnerabilities: {
        critical: Math.floor(Math.random() * 2),
        high: Math.floor(Math.random() * 5),
        medium: Math.floor(Math.random() * 10),
        low: Math.floor(Math.random() * 20)
      },
      dependencies: {
        total: Math.floor(Math.random() * 100) + 10,
        outdated: Math.floor(Math.random() * 20),
        vulnerable: Math.floor(Math.random() * 5)
      },
      licenses: ['MIT', 'Apache-2.0'],
      cveList: []
    };

    this.securityScans.set(pluginId, scan);
    return scan;
  }

  // Private helper methods

  private async checkSecurityPolicy(
    pluginId: string,
    version?: string
  ): Promise<{passed: boolean; violations: PolicyViolation[]; requiresApproval: boolean; approvers: string[]}> {
    const violations: PolicyViolation[] = [];
    const approvers: string[] = [];
    let requiresApproval = false;

    // Get or perform security scan
    let scan = this.securityScans.get(pluginId);
    if (!scan && version) {
      scan = await this.performSecurityScan(pluginId, version);
    }

    if (scan) {
      // Check vulnerability thresholds
      if (scan.vulnerabilities.critical > 0) {
        violations.push({
          policyId: 'no-critical-vulns',
          policyName: 'No Critical Vulnerabilities',
          rule: 'vulnerability-check',
          severity: 'critical',
          message: `Plugin has ${scan.vulnerabilities.critical} critical vulnerabilities`
        });
      }

      if (scan.vulnerabilities.high > 5) {
        violations.push({
          policyId: 'high-vuln-limit',
          policyName: 'High Vulnerability Limit',
          rule: 'vulnerability-check',
          severity: 'high',
          message: `Plugin has ${scan.vulnerabilities.high} high vulnerabilities (limit: 5)`
        });
        requiresApproval = true;
        approvers.push('security-team');
      }

      // Check dependency vulnerabilities
      if (scan.dependencies.vulnerable > 0) {
        violations.push({
          policyId: 'vulnerable-deps',
          policyName: 'Vulnerable Dependencies',
          rule: 'dependency-check',
          severity: 'medium',
          message: `Plugin has ${scan.dependencies.vulnerable} vulnerable dependencies`
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      requiresApproval,
      approvers
    };
  }

  private async checkLicensePolicy(
    pluginId: string,
    version?: string
  ): Promise<{passed: boolean; violations: PolicyViolation[]; requiresApproval: boolean; approvers: string[]}> {
    const violations: PolicyViolation[] = [];
    const approvers: string[] = [];
    let requiresApproval = false;

    // Get plugin licenses
    const scan = this.securityScans.get(pluginId);
    const licenses = scan?.licenses || [];

    // Check against approved licenses
    const approvedLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];
    const unapprovedLicenses = licenses.filter(l => !approvedLicenses.includes(l));

    if (unapprovedLicenses.length > 0) {
      violations.push({
        policyId: 'approved-licenses',
        policyName: 'Approved Licenses Only',
        rule: 'license-check',
        severity: 'medium',
        message: `Plugin uses unapproved licenses: ${unapprovedLicenses.join(', ')}`
      });
      requiresApproval = true;
      approvers.push('legal-team');
    }

    // Check for GPL licenses
    const gplLicenses = licenses.filter(l => l.includes('GPL'));
    if (gplLicenses.length > 0) {
      violations.push({
        policyId: 'no-gpl',
        policyName: 'No GPL Licenses',
        rule: 'license-check',
        severity: 'high',
        message: `Plugin uses GPL licenses: ${gplLicenses.join(', ')}`
      });
    }

    return {
      passed: violations.length === 0,
      violations,
      requiresApproval,
      approvers
    };
  }

  private async checkResourcePolicy(
    pluginId: string
  ): Promise<{passed: boolean; violations: PolicyViolation[]}> {
    const violations: PolicyViolation[] = [];
    
    // Check resource quotas
    const quota = this.resourceQuotas.get(pluginId);
    if (quota) {
      if (quota.cpuUsage > quota.cpuLimit) {
        violations.push({
          policyId: 'cpu-quota',
          policyName: 'CPU Quota',
          rule: 'resource-check',
          severity: 'medium',
          message: `CPU usage (${quota.cpuUsage}%) exceeds limit (${quota.cpuLimit}%)`
        });
      }

      if (quota.memoryUsage > quota.memoryLimit) {
        violations.push({
          policyId: 'memory-quota',
          policyName: 'Memory Quota',
          rule: 'resource-check',
          severity: 'medium',
          message: `Memory usage (${quota.memoryUsage}MB) exceeds limit (${quota.memoryLimit}MB)`
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  private checkAllowlist(pluginId: string): {passed: boolean; message?: string} {
    // In production, maintain allowlist/blocklist in database
    const blocklist = ['malicious-plugin', 'deprecated-plugin'];
    const allowlist = ['@backstage/*', '@roadiehq/*'];

    if (blocklist.includes(pluginId)) {
      return { passed: false, message: 'Plugin is blocklisted' };
    }

    // Check if allowlist is enforced
    const enforceAllowlist = this.policies.get('enforce-allowlist')?.active;
    if (enforceAllowlist) {
      const isAllowed = allowlist.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(pluginId);
        }
        return pattern === pluginId;
      });

      if (!isAllowed) {
        return { passed: false, message: 'Plugin not on allowlist' };
      }
    }

    return { passed: true };
  }

  private calculateRiskScore(violations: PolicyViolation[]): number {
    const weights = {
      critical: 40,
      high: 20,
      medium: 10,
      low: 5
    };

    let score = 0;
    for (const violation of violations) {
      score += weights[violation.severity];
    }

    return Math.min(100, score);
  }

  private calculateSecurityScore(scan: SecurityScan): number {
    const baseScore = 100;
    let deductions = 0;

    deductions += scan.vulnerabilities.critical * 20;
    deductions += scan.vulnerabilities.high * 10;
    deductions += scan.vulnerabilities.medium * 5;
    deductions += scan.vulnerabilities.low * 2;
    deductions += scan.dependencies.vulnerable * 5;

    return Math.max(0, baseScore - deductions);
  }

  private calculateOverallRiskScore(violations: PolicyViolation[]): number {
    return this.calculateRiskScore(violations);
  }

  private generateRecommendations(violations: PolicyViolation[]): string[] {
    const recommendations: string[] = [];
    const violationTypes = new Set(violations.map(v => v.policyId));

    if (violationTypes.has('no-critical-vulns') || violationTypes.has('high-vuln-limit')) {
      recommendations.push('Schedule security patching for vulnerable plugins');
      recommendations.push('Enable automated security scanning in CI/CD pipeline');
    }

    if (violationTypes.has('approved-licenses') || violationTypes.has('no-gpl')) {
      recommendations.push('Review and update license compliance policies');
      recommendations.push('Implement license scanning in plugin approval workflow');
    }

    if (violationTypes.has('cpu-quota') || violationTypes.has('memory-quota')) {
      recommendations.push('Review resource quotas and optimize plugin performance');
      recommendations.push('Implement resource monitoring and alerting');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue regular compliance monitoring');
      recommendations.push('Keep governance policies up to date');
    }

    return recommendations;
  }

  private async createApprovalRequest(request: {
    pluginId: string;
    version?: string;
    requestType: string;
    violations: PolicyViolation[];
    requiredApprovals: string[];
    riskScore: number;
  }): Promise<string> {
    const approvalId = `approval_${Date.now()}`;
    const approvalRequest: ApprovalRequest = {
      id: approvalId,
      ...request,
      status: 'pending',
      createdAt: new Date(),
      approvals: []
    };

    this.approvals.set(approvalId, approvalRequest);
    return approvalId;
  }

  private async getApprovalStatus(pluginId: string): Promise<'approved' | 'pending' | 'rejected' | 'not-required'> {
    // Check if there are any pending approvals
    for (const approval of this.approvals.values()) {
      if (approval.pluginId === pluginId && approval.status === 'pending') {
        return 'pending';
      }
      if (approval.pluginId === pluginId && approval.status === 'rejected') {
        return 'rejected';
      }
    }

    // Check if plugin has been approved
    const hasApproval = Array.from(this.approvals.values()).some(
      a => a.pluginId === pluginId && a.status === 'approved'
    );

    return hasApproval ? 'approved' : 'not-required';
  }

  private async getCurrentVersion(pluginId: string): Promise<string | null> {
    // In production, fetch from plugin registry
    return '1.0.0';
  }

  private isDowngrade(currentVersion: string, targetVersion: string): boolean {
    // Simple version comparison - in production use semver
    return targetVersion < currentVersion;
  }

  private async getLastUpdateTime(pluginId: string): Promise<Date | null> {
    // In production, fetch from audit log
    return null;
  }

  private async getAllPlugins(): Promise<string[]> {
    // In production, fetch from plugin registry
    return ['plugin1', 'plugin2', 'plugin3'];
  }

  private initializeDefaultPolicies(): void {
    // Initialize default governance policies
    this.policies.set('no-critical-vulns', {
      id: 'no-critical-vulns',
      name: 'No Critical Vulnerabilities',
      type: 'security',
      rules: [{
        condition: 'vulnerabilities.critical',
        value: 0,
        operator: 'equals',
        action: 'deny',
        message: 'Plugins with critical vulnerabilities are not allowed'
      }],
      enforcementLevel: 'strict',
      exemptions: [],
      approvers: ['security-team'],
      active: true
    });

    this.policies.set('approved-licenses', {
      id: 'approved-licenses',
      name: 'Approved Licenses Only',
      type: 'license',
      rules: [{
        condition: 'license',
        value: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
        operator: 'contains',
        action: 'allow'
      }],
      enforcementLevel: 'warning',
      exemptions: [],
      approvers: ['legal-team'],
      active: true
    });

    this.policies.set('resource-limits', {
      id: 'resource-limits',
      name: 'Resource Limits',
      type: 'resource',
      rules: [{
        condition: 'cpu',
        value: 80,
        operator: 'less',
        action: 'allow'
      }, {
        condition: 'memory',
        value: 2048,
        operator: 'less',
        action: 'allow'
      }],
      enforcementLevel: 'warning',
      exemptions: [],
      approvers: ['platform-team'],
      active: true
    });
  }
}

// Supporting interfaces

interface ApprovalRequest {
  id: string;
  pluginId: string;
  version?: string;
  requestType: string;
  violations: PolicyViolation[];
  requiredApprovals: string[];
  riskScore: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  approvals: Array<{
    approver: string;
    decision: 'approve' | 'reject';
    timestamp: Date;
    comment?: string;
  }>;
}

interface AuditEntry {
  timestamp: Date;
  action: string;
  pluginId: string;
  version?: string;
  result: string;
  violations: PolicyViolation[];
  riskScore: number;
}

interface ResourceQuota {
  pluginId: string;
  cpuLimit: number;
  cpuUsage: number;
  memoryLimit: number;
  memoryUsage: number;
  storageLimit: number;
  storageUsage: number;
}