/**
 * Enterprise Security Report Generator
 * Generates comprehensive security audit reports for executives and technical teams
 */

import { SecurityAuditResult, SecurityVulnerability } from './SecurityAuditor';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExecutiveSummary {
  overallRiskLevel: string;
  keyFindings: string[];
  businessImpact: string;
  priorityActions: string[];
  complianceStatus: string;
  timeToRemediation: string;
}

export interface TechnicalDetails {
  vulnerabilityBreakdown: {
    category: string;
    count: number;
    highestSeverity: string;
  }[];
  remediationSteps: {
    priority: number;
    vulnerability: SecurityVulnerability;
    technicalSteps: string[];
    estimatedEffort: string;
  }[];
  architecturalRecommendations: string[];
}

export class SecurityReportGenerator {
  constructor(private auditResult: SecurityAuditResult) {}

  /**
   * Generate comprehensive security report
   */
  async generateComprehensiveReport(): Promise<{
    executiveSummary: ExecutiveSummary;
    technicalDetails: TechnicalDetails;
    htmlReport: string;
    markdownReport: string;
  }> {
    const executiveSummary = this.generateExecutiveSummary();
    const technicalDetails = this.generateTechnicalDetails();
    const htmlReport = await this.generateHTMLReport(executiveSummary, technicalDetails);
    const markdownReport = this.generateMarkdownReport(executiveSummary, technicalDetails);

    return {
      executiveSummary,
      technicalDetails,
      htmlReport,
      markdownReport
    };
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(): ExecutiveSummary {
    const { vulnerabilities, metrics, overallRisk, complianceStatus } = this.auditResult;

    const keyFindings = [
      `${metrics.totalVulnerabilities} security vulnerabilities identified`,
      `${metrics.criticalCount} critical and ${metrics.highCount} high-severity issues`,
      `Remediation score: ${metrics.remediationScore}%`,
      this.getComplianceStatusSummary(complianceStatus)
    ];

    const businessImpact = this.assessBusinessImpact();
    const priorityActions = this.getPriorityActions();
    const complianceStatusText = this.formatComplianceStatus(complianceStatus);
    const timeToRemediation = this.estimateRemediationTime();

    return {
      overallRiskLevel: overallRisk.toUpperCase(),
      keyFindings,
      businessImpact,
      priorityActions,
      complianceStatus: complianceStatusText,
      timeToRemediation
    };
  }

  /**
   * Generate technical details
   */
  private generateTechnicalDetails(): TechnicalDetails {
    const vulnerabilityBreakdown = this.getVulnerabilityBreakdown();
    const remediationSteps = this.getDetailedRemediationSteps();
    const architecturalRecommendations = this.getArchitecturalRecommendations();

    return {
      vulnerabilityBreakdown,
      remediationSteps,
      architecturalRecommendations
    };
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(
    executiveSummary: ExecutiveSummary,
    technicalDetails: TechnicalDetails
  ): Promise<string> {
    const template = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Security Audit Report - ${new Date().toISOString().split('T')[0]}</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .header { 
                text-align: center; 
                border-bottom: 3px solid #007bff; 
                padding-bottom: 20px; 
                margin-bottom: 30px;
            }
            .risk-critical { color: #dc3545; font-weight: bold; }
            .risk-high { color: #fd7e14; font-weight: bold; }
            .risk-medium { color: #ffc107; font-weight: bold; }
            .risk-low { color: #28a745; font-weight: bold; }
            .executive-summary { 
                background: #f8f9fa; 
                padding: 20px; 
                border-radius: 8px; 
                margin-bottom: 30px; 
            }
            .metric-card { 
                display: inline-block; 
                background: white; 
                padding: 15px; 
                margin: 10px; 
                border-radius: 8px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
                min-width: 150px;
            }
            .vulnerability-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 20px 0; 
            }
            .vulnerability-table th, 
            .vulnerability-table td { 
                padding: 12px; 
                text-align: left; 
                border-bottom: 1px solid #dee2e6; 
            }
            .vulnerability-table th { 
                background-color: #007bff; 
                color: white; 
            }
            .severity-critical { background-color: #f8d7da; }
            .severity-high { background-color: #fde2e4; }
            .severity-medium { background-color: #fff3cd; }
            .severity-low { background-color: #d1ecf1; }
            .section { margin-bottom: 40px; }
            .compliance-status { 
                display: flex; 
                justify-content: space-around; 
                flex-wrap: wrap; 
            }
            .compliance-item { 
                text-align: center; 
                padding: 10px; 
                margin: 5px; 
                border-radius: 8px; 
            }
            .compliance-pass { background-color: #d4edda; color: #155724; }
            .compliance-fail { background-color: #f8d7da; color: #721c24; }
            .remediation-step {
                background: #f8f9fa;
                padding: 15px;
                margin: 10px 0;
                border-left: 4px solid #007bff;
                border-radius: 0 8px 8px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Enterprise Security Audit Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>Overall Risk Level: <span class="risk-${executiveSummary.overallRiskLevel.toLowerCase()}">${executiveSummary.overallRiskLevel}</span></p>
        </div>

        <div class="section executive-summary">
            <h2>Executive Summary</h2>
            <div>
                <div class="metric-card">
                    <h3>${this.auditResult.metrics.totalVulnerabilities}</h3>
                    <p>Total Vulnerabilities</p>
                </div>
                <div class="metric-card">
                    <h3 class="risk-critical">${this.auditResult.metrics.criticalCount}</h3>
                    <p>Critical Issues</p>
                </div>
                <div class="metric-card">
                    <h3 class="risk-high">${this.auditResult.metrics.highCount}</h3>
                    <p>High Priority</p>
                </div>
                <div class="metric-card">
                    <h3>${this.auditResult.metrics.remediationScore}%</h3>
                    <p>Remediation Score</p>
                </div>
            </div>
            
            <h3>Key Findings</h3>
            <ul>
                ${executiveSummary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
            </ul>

            <h3>Business Impact</h3>
            <p>${executiveSummary.businessImpact}</p>

            <h3>Priority Actions</h3>
            <ol>
                ${executiveSummary.priorityActions.map(action => `<li>${action}</li>`).join('')}
            </ol>
        </div>

        <div class="section">
            <h2>Compliance Status</h2>
            <div class="compliance-status">
                <div class="compliance-item ${this.auditResult.complianceStatus.soc2 ? 'compliance-pass' : 'compliance-fail'}">
                    <h4>SOC 2</h4>
                    <p>${this.auditResult.complianceStatus.soc2 ? 'COMPLIANT' : 'NON-COMPLIANT'}</p>
                </div>
                <div class="compliance-item ${this.auditResult.complianceStatus.gdpr ? 'compliance-pass' : 'compliance-fail'}">
                    <h4>GDPR</h4>
                    <p>${this.auditResult.complianceStatus.gdpr ? 'COMPLIANT' : 'NON-COMPLIANT'}</p>
                </div>
                <div class="compliance-item ${this.auditResult.complianceStatus.iso27001 ? 'compliance-pass' : 'compliance-fail'}">
                    <h4>ISO 27001</h4>
                    <p>${this.auditResult.complianceStatus.iso27001 ? 'COMPLIANT' : 'NON-COMPLIANT'}</p>
                </div>
                <div class="compliance-item ${this.auditResult.complianceStatus.pci ? 'compliance-pass' : 'compliance-fail'}">
                    <h4>PCI DSS</h4>
                    <p>${this.auditResult.complianceStatus.pci ? 'COMPLIANT' : 'NON-COMPLIANT'}</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Vulnerability Details</h2>
            <table class="vulnerability-table">
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Category</th>
                        <th>Title</th>
                        <th>Impact</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.auditResult.vulnerabilities
                      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
                      .map(vuln => `
                        <tr class="severity-${vuln.severity}">
                            <td><strong>${vuln.severity.toUpperCase()}</strong></td>
                            <td>${vuln.category}</td>
                            <td>${vuln.title}</td>
                            <td>${vuln.impact}</td>
                            <td>${vuln.confidence}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Detailed Remediation Steps</h2>
            ${technicalDetails.remediationSteps.map(step => `
                <div class="remediation-step">
                    <h4>Priority ${step.priority}: ${step.vulnerability.title}</h4>
                    <p><strong>Severity:</strong> ${step.vulnerability.severity.toUpperCase()}</p>
                    <p><strong>Impact:</strong> ${step.vulnerability.impact}</p>
                    <p><strong>Estimated Effort:</strong> ${step.estimatedEffort}</p>
                    <h5>Technical Steps:</h5>
                    <ol>
                        ${step.technicalSteps.map(techStep => `<li>${techStep}</li>`).join('')}
                    </ol>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Architectural Recommendations</h2>
            <ul>
                ${technicalDetails.architecturalRecommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            <ul>
                ${this.auditResult.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>

        <div class="section">
            <p><em>Report generated by Enterprise Security Auditor on ${this.auditResult.timestamp}</em></p>
        </div>
    </body>
    </html>`;

    return template;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(
    executiveSummary: ExecutiveSummary,
    technicalDetails: TechnicalDetails
  ): string {
    return `# Enterprise Security Audit Report

**Generated:** ${new Date().toLocaleDateString()}
**Overall Risk Level:** ${executiveSummary.overallRiskLevel}

## Executive Summary

### Key Metrics
- **Total Vulnerabilities:** ${this.auditResult.metrics.totalVulnerabilities}
- **Critical Issues:** ${this.auditResult.metrics.criticalCount}
- **High Priority Issues:** ${this.auditResult.metrics.highCount}
- **Remediation Score:** ${this.auditResult.metrics.remediationScore}%

### Key Findings
${executiveSummary.keyFindings.map(finding => `- ${finding}`).join('\n')}

### Business Impact
${executiveSummary.businessImpact}

### Priority Actions
${executiveSummary.priorityActions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

## Compliance Status

| Standard | Status |
|----------|--------|
| SOC 2 | ${this.auditResult.complianceStatus.soc2 ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'} |
| GDPR | ${this.auditResult.complianceStatus.gdpr ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'} |
| ISO 27001 | ${this.auditResult.complianceStatus.iso27001 ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'} |
| PCI DSS | ${this.auditResult.complianceStatus.pci ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'} |

## Vulnerability Breakdown

| Category | Count | Highest Severity |
|----------|-------|------------------|
${technicalDetails.vulnerabilityBreakdown.map(vb => 
  `| ${vb.category} | ${vb.count} | ${vb.highestSeverity} |`
).join('\n')}

## Detailed Vulnerability List

${this.auditResult.vulnerabilities
  .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
  .map(vuln => `
### ${vuln.severity.toUpperCase()}: ${vuln.title}

- **Category:** ${vuln.category}
- **Impact:** ${vuln.impact}
- **Remediation:** ${vuln.remediation}
- **Affected:** ${vuln.affected.join(', ')}
- **Confidence:** ${vuln.confidence}
${vuln.cwe ? `- **CWE:** ${vuln.cwe}` : ''}
${vuln.cvss ? `- **CVSS:** ${vuln.cvss}` : ''}
`).join('\n')}

## Remediation Roadmap

${technicalDetails.remediationSteps.map(step => `
### Priority ${step.priority}: ${step.vulnerability.title}

**Effort Estimate:** ${step.estimatedEffort}

**Technical Steps:**
${step.technicalSteps.map((techStep, i) => `${i + 1}. ${techStep}`).join('\n')}
`).join('\n')}

## Architectural Recommendations

${technicalDetails.architecturalRecommendations.map(rec => `- ${rec}`).join('\n')}

## General Recommendations

${this.auditResult.recommendations.map(rec => `- ${rec}`).join('\n')}

---

*Report generated by Enterprise Security Auditor on ${this.auditResult.timestamp}*`;
  }

  private assessBusinessImpact(): string {
    const { metrics, overallRisk } = this.auditResult;
    
    if (overallRisk === 'critical') {
      return 'CRITICAL: Immediate action required. Current vulnerabilities pose significant risk to business operations, customer data, and regulatory compliance. Risk of data breaches, service disruption, and regulatory penalties.';
    } else if (overallRisk === 'high') {
      return 'HIGH: Urgent remediation needed. Security vulnerabilities could lead to data compromise, service availability issues, and compliance violations. Recommend addressing within 2 weeks.';
    } else if (overallRisk === 'medium') {
      return 'MEDIUM: Moderate risk level. While not immediately critical, these vulnerabilities should be addressed to maintain security posture and prevent escalation. Target remediation within 30 days.';
    } else {
      return 'LOW: Security posture is generally good. Address identified vulnerabilities as part of regular security maintenance. Monitor for new threats and maintain current security controls.';
    }
  }

  private getPriorityActions(): string[] {
    const actions = [];
    
    if (this.auditResult.metrics.criticalCount > 0) {
      actions.push('Address all critical vulnerabilities immediately');
    }
    
    if (this.auditResult.metrics.highCount > 0) {
      actions.push('Prioritize high-severity vulnerability remediation');
    }
    
    actions.push(
      'Implement automated security scanning in CI/CD pipeline',
      'Conduct security training for development team',
      'Establish incident response procedures'
    );

    if (!this.auditResult.complianceStatus.soc2) {
      actions.push('Address SOC 2 compliance gaps');
    }
    
    if (!this.auditResult.complianceStatus.gdpr) {
      actions.push('Implement GDPR compliance controls');
    }

    return actions.slice(0, 5); // Top 5 actions
  }

  private getComplianceStatusSummary(complianceStatus: any): string {
    const compliant = Object.values(complianceStatus).filter(status => status === true).length;
    const total = Object.keys(complianceStatus).length;
    return `${compliant}/${total} compliance standards met`;
  }

  private formatComplianceStatus(complianceStatus: any): string {
    return Object.entries(complianceStatus)
      .map(([standard, status]) => `${standard.toUpperCase()}: ${status ? 'COMPLIANT' : 'NON-COMPLIANT'}`)
      .join(', ');
  }

  private estimateRemediationTime(): string {
    const { metrics } = this.auditResult;
    let totalHours = 0;

    totalHours += metrics.criticalCount * 16; // 2 days per critical
    totalHours += metrics.highCount * 8;     // 1 day per high
    totalHours += metrics.mediumCount * 4;   // 4 hours per medium
    totalHours += metrics.lowCount * 2;      // 2 hours per low

    const days = Math.ceil(totalHours / 8);
    
    if (days <= 7) return `${days} days`;
    if (days <= 30) return `${Math.ceil(days / 7)} weeks`;
    return `${Math.ceil(days / 30)} months`;
  }

  private getVulnerabilityBreakdown(): TechnicalDetails['vulnerabilityBreakdown'] {
    const categories = new Map<string, { count: number; severities: string[] }>();

    this.auditResult.vulnerabilities.forEach(vuln => {
      if (!categories.has(vuln.category)) {
        categories.set(vuln.category, { count: 0, severities: [] });
      }
      const category = categories.get(vuln.category)!;
      category.count++;
      category.severities.push(vuln.severity);
    });

    return Array.from(categories.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      highestSeverity: this.getHighestSeverity(data.severities)
    }));
  }

  private getDetailedRemediationSteps(): TechnicalDetails['remediationSteps'] {
    return this.auditResult.vulnerabilities
      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
      .slice(0, 10) // Top 10 for detailed steps
      .map((vulnerability, index) => ({
        priority: index + 1,
        vulnerability,
        technicalSteps: this.getTechnicalSteps(vulnerability),
        estimatedEffort: this.estimateEffort(vulnerability)
      }));
  }

  private getTechnicalSteps(vulnerability: SecurityVulnerability): string[] {
    // Generate technical steps based on vulnerability type
    const steps = [vulnerability.remediation];

    if (vulnerability.category === 'Dependency Security') {
      steps.push(
        'Run npm audit to identify vulnerable packages',
        'Update package.json with secure versions',
        'Test application functionality after updates',
        'Update lock files and commit changes'
      );
    } else if (vulnerability.category === 'Authentication Security') {
      steps.push(
        'Review authentication flow implementation',
        'Update security policies and configurations',
        'Test authentication mechanisms',
        'Update documentation and security procedures'
      );
    } else {
      steps.push(
        'Review affected code and configurations',
        'Implement security controls',
        'Test changes thoroughly',
        'Deploy to production with monitoring'
      );
    }

    return steps;
  }

  private estimateEffort(vulnerability: SecurityVulnerability): string {
    const effortMap = {
      critical: '2-3 days',
      high: '1-2 days',
      medium: '4-8 hours',
      low: '1-2 hours'
    };

    return effortMap[vulnerability.severity] || '1-2 hours';
  }

  private getArchitecturalRecommendations(): string[] {
    return [
      'Implement Zero Trust architecture principles',
      'Deploy comprehensive monitoring and alerting',
      'Establish automated security testing in CI/CD',
      'Implement secrets management solution',
      'Deploy web application firewall (WAF)',
      'Establish security incident response procedures',
      'Implement data encryption at rest and in transit',
      'Deploy container security scanning',
      'Establish regular security assessments',
      'Implement privileged access management (PAM)'
    ];
  }

  private getHighestSeverity(severities: string[]): string {
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    for (const severity of severityOrder) {
      if (severities.includes(severity)) return severity;
    }
    return 'low';
  }

  private getSeverityWeight(severity: string): number {
    const weights = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
    return weights[severity as keyof typeof weights] || 0;
  }

  /**
   * Save reports to files
   */
  async saveReports(outputDir: string = './security-reports'): Promise<{
    htmlPath: string;
    markdownPath: string;
  }> {
    const timestamp = new Date().toISOString().split('T')[0];
    const reports = await this.generateComprehensiveReport();

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Save HTML report
    const htmlPath = path.join(outputDir, `security-audit-${timestamp}.html`);
    await fs.writeFile(htmlPath, reports.htmlReport, 'utf8');

    // Save Markdown report
    const markdownPath = path.join(outputDir, `security-audit-${timestamp}.md`);
    await fs.writeFile(markdownPath, reports.markdownReport, 'utf8');

    return { htmlPath, markdownPath };
  }
}

export default SecurityReportGenerator;