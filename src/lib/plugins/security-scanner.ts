import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface SecurityScanResult {
  id: string;
  pluginId: string;
  version: string;
  scanDate: Date;
  status: 'clean' | 'warning' | 'critical' | 'error';
  vulnerabilities: Vulnerability[];
  dependencies: DependencyScan[];
  codeAnalysis: CodeAnalysis;
  containerScan?: ContainerScanResult;
  compliance: ComplianceCheck[];
  riskScore: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  recommendations: string[];
}

interface Vulnerability {
  id: string;
  type: 'dependency' | 'code' | 'configuration' | 'container';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  cve?: string;
  cwe?: string;
  owasp?: string;
  affectedComponent: string;
  affectedVersion?: string;
  fixedVersion?: string;
  exploitAvailable: boolean;
  publicExploit?: boolean;
  remediation: string;
  references: string[];
  score: number;
}

interface DependencyScan {
  name: string;
  version: string;
  license: string;
  vulnerabilities: number;
  outdated: boolean;
  deprecated: boolean;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  alternatives?: string[];
}

interface CodeAnalysis {
  linesOfCode: number;
  complexity: number;
  coverage?: number;
  issues: CodeIssue[];
  secrets: SecretDetection[];
  permissions: PermissionAnalysis[];
}

interface CodeIssue {
  type: 'security' | 'quality' | 'performance' | 'style';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  rule: string;
  message: string;
  suggestion?: string;
}

interface SecretDetection {
  type: string;
  file: string;
  line: number;
  match: string;
  entropy: number;
  verified: boolean;
}

interface PermissionAnalysis {
  permission: string;
  scope: string;
  risk: 'low' | 'medium' | 'high';
  justification?: string;
}

interface ContainerScanResult {
  image: string;
  tag: string;
  digest: string;
  os: string;
  architecture: string;
  layers: number;
  size: number;
  vulnerabilities: ContainerVulnerability[];
  malware: boolean;
  secrets: number;
  misconfigurations: string[];
}

interface ContainerVulnerability {
  package: string;
  version: string;
  severity: string;
  cve: string;
  description: string;
  fixedVersion?: string;
}

interface ComplianceCheck {
  standard: 'CIS' | 'PCI-DSS' | 'HIPAA' | 'SOC2' | 'GDPR' | 'NIST';
  version: string;
  passed: boolean;
  score: number;
  findings: ComplianceFinding[];
}

interface ComplianceFinding {
  id: string;
  title: string;
  description: string;
  severity: string;
  remediation: string;
  evidence?: string;
}

export class SecurityScanner {
  private scanners: Map<string, Scanner>;
  private scanHistory: Map<string, SecurityScanResult[]>;
  private policies: SecurityPolicy[];

  constructor() {
    this.scanners = new Map();
    this.scanHistory = new Map();
    this.policies = [];
    this.initializeScanners();
  }

  private initializeScanners() {
    // Initialize various security scanners
    this.scanners.set('dependency', new DependencyScanner());
    this.scanners.set('static', new StaticAnalysisScanner());
    this.scanners.set('container', new ContainerScanner());
    this.scanners.set('secret', new SecretScanner());
    this.scanners.set('license', new LicenseScanner());
    this.scanners.set('compliance', new ComplianceScanner());
  }

  async scanPlugin(
    pluginId: string,
    options: {
      version?: string;
      sourcePath?: string;
      imageName?: string;
      deep?: boolean;
      compliance?: string[];
    } = {}
  ): Promise<SecurityScanResult> {
    const scanId = crypto.randomBytes(16).toString('hex');
    const result: SecurityScanResult = {
      id: scanId,
      pluginId,
      version: options.version || 'latest',
      scanDate: new Date(),
      status: 'clean',
      vulnerabilities: [],
      dependencies: [],
      codeAnalysis: {
        linesOfCode: 0,
        complexity: 0,
        issues: [],
        secrets: [],
        permissions: []
      },
      compliance: [],
      riskScore: 0,
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      recommendations: []
    };

    try {
      // Run dependency scan
      if (this.scanners.has('dependency')) {
        const depScan = await this.scanners.get('dependency')!.scan({
          path: options.sourcePath,
          pluginId
        });
        result.dependencies = depScan.dependencies;
        result.vulnerabilities.push(...depScan.vulnerabilities);
      }

      // Run static code analysis
      if (this.scanners.has('static') && options.sourcePath) {
        const staticScan = await this.scanners.get('static')!.scan({
          path: options.sourcePath
        });
        result.codeAnalysis = staticScan;
        result.vulnerabilities.push(...this.convertCodeIssuesToVulnerabilities(staticScan.issues));
      }

      // Run container scan if image provided
      if (this.scanners.has('container') && options.imageName) {
        const containerScan = await this.scanners.get('container')!.scan({
          image: options.imageName
        });
        result.containerScan = containerScan;
        result.vulnerabilities.push(...this.convertContainerVulnerabilities(containerScan.vulnerabilities));
      }

      // Run secret detection
      if (this.scanners.has('secret') && options.sourcePath) {
        const secretScan = await this.scanners.get('secret')!.scan({
          path: options.sourcePath
        });
        result.codeAnalysis.secrets = secretScan.secrets;
        
        // Add high-severity vulnerabilities for detected secrets
        secretScan.secrets.forEach(secret => {
          result.vulnerabilities.push({
            id: crypto.randomBytes(8).toString('hex'),
            type: 'code',
            severity: 'critical',
            title: `Hardcoded ${secret.type} detected`,
            description: `Found potential ${secret.type} in ${secret.file}:${secret.line}`,
            affectedComponent: secret.file,
            exploitAvailable: true,
            publicExploit: true,
            remediation: 'Remove hardcoded secrets and use environment variables or secret management service',
            references: [],
            score: 9.5
          });
        });
      }

      // Run compliance checks
      if (options.compliance && options.compliance.length > 0) {
        for (const standard of options.compliance) {
          const complianceScan = await this.scanners.get('compliance')!.scan({
            standard,
            path: options.sourcePath,
            image: options.imageName
          });
          result.compliance.push(complianceScan);
        }
      }

      // Calculate summary
      result.vulnerabilities.forEach(vuln => {
        result.summary[vuln.severity]++;
      });

      // Calculate risk score
      result.riskScore = this.calculateRiskScore(result);

      // Determine overall status
      if (result.summary.critical > 0) {
        result.status = 'critical';
      } else if (result.summary.high > 0) {
        result.status = 'warning';
      } else if (result.summary.medium > 0) {
        result.status = 'warning';
      } else {
        result.status = 'clean';
      }

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result);

      // Store scan result
      if (!this.scanHistory.has(pluginId)) {
        this.scanHistory.set(pluginId, []);
      }
      this.scanHistory.get(pluginId)!.push(result);

    } catch (error) {
      result.status = 'error';
      result.recommendations.push('Scan failed - please check plugin accessibility and try again');
    }

    return result;
  }

  private convertCodeIssuesToVulnerabilities(issues: CodeIssue[]): Vulnerability[] {
    return issues
      .filter(issue => issue.type === 'security')
      .map(issue => ({
        id: crypto.randomBytes(8).toString('hex'),
        type: 'code' as const,
        severity: this.mapIssueSeverity(issue.severity),
        title: issue.rule,
        description: issue.message,
        affectedComponent: `${issue.file}:${issue.line}:${issue.column}`,
        exploitAvailable: false,
        remediation: issue.suggestion || 'Review and fix the security issue',
        references: [],
        score: this.calculateIssueScore(issue.severity)
      }));
  }

  private convertContainerVulnerabilities(vulns: ContainerVulnerability[]): Vulnerability[] {
    return vulns.map(vuln => ({
      id: crypto.randomBytes(8).toString('hex'),
      type: 'container' as const,
      severity: vuln.severity.toLowerCase() as any,
      title: `${vuln.package} vulnerability`,
      description: vuln.description,
      cve: vuln.cve,
      affectedComponent: vuln.package,
      affectedVersion: vuln.version,
      fixedVersion: vuln.fixedVersion,
      exploitAvailable: false,
      remediation: vuln.fixedVersion 
        ? `Upgrade ${vuln.package} to ${vuln.fixedVersion}`
        : 'No fix available yet',
      references: [`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vuln.cve}`],
      score: 0
    }));
  }

  private mapIssueSeverity(severity: string): Vulnerability['severity'] {
    switch (severity) {
      case 'error':
        return 'high';
      case 'warning':
        return 'medium';
      default:
        return 'low';
    }
  }

  private calculateIssueScore(severity: string): number {
    switch (severity) {
      case 'error':
        return 7.5;
      case 'warning':
        return 5.0;
      default:
        return 2.5;
    }
  }

  private calculateRiskScore(result: SecurityScanResult): number {
    let score = 0;
    
    // Weight vulnerabilities
    score += result.summary.critical * 40;
    score += result.summary.high * 20;
    score += result.summary.medium * 10;
    score += result.summary.low * 5;
    score += result.summary.info * 1;

    // Factor in code quality
    if (result.codeAnalysis) {
      score += result.codeAnalysis.issues.length * 2;
      score += result.codeAnalysis.secrets.length * 50;
    }

    // Factor in compliance
    result.compliance.forEach(check => {
      if (!check.passed) {
        score += (100 - check.score);
      }
    });

    // Normalize to 0-100
    return Math.min(100, Math.max(0, score));
  }

  private generateRecommendations(result: SecurityScanResult): string[] {
    const recommendations: string[] = [];

    if (result.summary.critical > 0) {
      recommendations.push('URGENT: Fix critical vulnerabilities before deployment');
    }

    if (result.codeAnalysis.secrets.length > 0) {
      recommendations.push('Remove all hardcoded secrets and use secret management');
    }

    if (result.summary.high > 5) {
      recommendations.push('Consider addressing high-severity vulnerabilities');
    }

    const outdatedDeps = result.dependencies.filter(d => d.outdated).length;
    if (outdatedDeps > 0) {
      recommendations.push(`Update ${outdatedDeps} outdated dependencies`);
    }

    const deprecatedDeps = result.dependencies.filter(d => d.deprecated).length;
    if (deprecatedDeps > 0) {
      recommendations.push(`Replace ${deprecatedDeps} deprecated dependencies`);
    }

    if (result.containerScan?.misconfigurations.length > 0) {
      recommendations.push('Fix container misconfigurations for better security');
    }

    if (result.compliance.some(c => !c.passed)) {
      recommendations.push('Address compliance violations before production deployment');
    }

    if (recommendations.length === 0) {
      recommendations.push('Plugin passes basic security checks');
    }

    return recommendations;
  }

  async compareScans(
    pluginId: string,
    scan1Id: string,
    scan2Id: string
  ): Promise<{
    improved: string[];
    degraded: string[];
    unchanged: string[];
    newVulnerabilities: Vulnerability[];
    fixedVulnerabilities: Vulnerability[];
  }> {
    const history = this.scanHistory.get(pluginId) || [];
    const scan1 = history.find(s => s.id === scan1Id);
    const scan2 = history.find(s => s.id === scan2Id);

    if (!scan1 || !scan2) {
      throw new Error('Scan results not found');
    }

    const improved: string[] = [];
    const degraded: string[] = [];
    const unchanged: string[] = [];

    // Compare vulnerability counts
    if (scan2.summary.critical < scan1.summary.critical) {
      improved.push(`Critical vulnerabilities reduced from ${scan1.summary.critical} to ${scan2.summary.critical}`);
    } else if (scan2.summary.critical > scan1.summary.critical) {
      degraded.push(`Critical vulnerabilities increased from ${scan1.summary.critical} to ${scan2.summary.critical}`);
    }

    // Compare risk scores
    if (scan2.riskScore < scan1.riskScore) {
      improved.push(`Risk score improved from ${scan1.riskScore} to ${scan2.riskScore}`);
    } else if (scan2.riskScore > scan1.riskScore) {
      degraded.push(`Risk score degraded from ${scan1.riskScore} to ${scan2.riskScore}`);
    }

    // Find new and fixed vulnerabilities
    const scan1VulnIds = new Set(scan1.vulnerabilities.map(v => v.cve || v.id));
    const scan2VulnIds = new Set(scan2.vulnerabilities.map(v => v.cve || v.id));

    const newVulnerabilities = scan2.vulnerabilities.filter(v => 
      !scan1VulnIds.has(v.cve || v.id)
    );

    const fixedVulnerabilities = scan1.vulnerabilities.filter(v => 
      !scan2VulnIds.has(v.cve || v.id)
    );

    return {
      improved,
      degraded,
      unchanged,
      newVulnerabilities,
      fixedVulnerabilities
    };
  }

  async generateReport(
    scanResult: SecurityScanResult,
    format: 'json' | 'html' | 'pdf' | 'sarif' = 'json'
  ): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(scanResult, null, 2);
      
      case 'sarif':
        return this.generateSARIFReport(scanResult);
      
      case 'html':
        return this.generateHTMLReport(scanResult);
      
      case 'pdf':
        // Would use a PDF generation library
        return 'PDF generation not implemented';
      
      default:
        return JSON.stringify(scanResult, null, 2);
    }
  }

  private generateSARIFReport(result: SecurityScanResult): string {
    const sarif = {
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'Backstage Security Scanner',
            version: '1.0.0',
            rules: result.vulnerabilities.map(v => ({
              id: v.id,
              name: v.title,
              shortDescription: { text: v.description },
              help: { text: v.remediation },
              properties: {
                severity: v.severity,
                cve: v.cve,
                cwe: v.cwe
              }
            }))
          }
        },
        results: result.vulnerabilities.map(v => ({
          ruleId: v.id,
          level: this.mapSeverityToSARIFLevel(v.severity),
          message: { text: v.description },
          locations: [{
            physicalLocation: {
              artifactLocation: {
                uri: v.affectedComponent
              }
            }
          }]
        }))
      }]
    };

    return JSON.stringify(sarif, null, 2);
  }

  private mapSeverityToSARIFLevel(severity: string): string {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'note';
    }
  }

  private generateHTMLReport(result: SecurityScanResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Security Scan Report - ${result.pluginId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
    .status-${result.status} { color: ${this.getStatusColor(result.status)}; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-item { background: #f9f9f9; padding: 10px; border-radius: 5px; }
    .vulnerability { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
    .severity-critical { border-left: 4px solid #d32f2f; }
    .severity-high { border-left: 4px solid #f57c00; }
    .severity-medium { border-left: 4px solid #fbc02d; }
    .severity-low { border-left: 4px solid #388e3c; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Scan Report</h1>
    <p>Plugin: ${result.pluginId} v${result.version}</p>
    <p>Scan Date: ${result.scanDate}</p>
    <p>Status: <span class="status-${result.status}">${result.status.toUpperCase()}</span></p>
    <p>Risk Score: ${result.riskScore}/100</p>
  </div>

  <div class="summary">
    <div class="summary-item">
      <h3>Critical</h3>
      <p>${result.summary.critical}</p>
    </div>
    <div class="summary-item">
      <h3>High</h3>
      <p>${result.summary.high}</p>
    </div>
    <div class="summary-item">
      <h3>Medium</h3>
      <p>${result.summary.medium}</p>
    </div>
    <div class="summary-item">
      <h3>Low</h3>
      <p>${result.summary.low}</p>
    </div>
  </div>

  <h2>Vulnerabilities</h2>
  ${result.vulnerabilities.map(v => `
    <div class="vulnerability severity-${v.severity}">
      <h3>${v.title}</h3>
      <p>${v.description}</p>
      <p><strong>Severity:</strong> ${v.severity}</p>
      ${v.cve ? `<p><strong>CVE:</strong> ${v.cve}</p>` : ''}
      <p><strong>Remediation:</strong> ${v.remediation}</p>
    </div>
  `).join('')}

  <h2>Recommendations</h2>
  <ul>
    ${result.recommendations.map(r => `<li>${r}</li>`).join('')}
  </ul>
</body>
</html>
    `;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'clean':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      case 'critical':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  }
}

// Scanner implementations
abstract class Scanner {
  abstract scan(options: any): Promise<any>;
}

class DependencyScanner extends Scanner {
  async scan(options: { path?: string; pluginId: string }): Promise<{
    dependencies: DependencyScan[];
    vulnerabilities: Vulnerability[];
  }> {
    // In production, would use tools like npm audit, snyk, etc.
    return {
      dependencies: [],
      vulnerabilities: []
    };
  }
}

class StaticAnalysisScanner extends Scanner {
  async scan(options: { path: string }): Promise<CodeAnalysis> {
    // In production, would use tools like ESLint, SonarJS, etc.
    return {
      linesOfCode: 0,
      complexity: 0,
      issues: [],
      secrets: [],
      permissions: []
    };
  }
}

class ContainerScanner extends Scanner {
  async scan(options: { image: string }): Promise<ContainerScanResult> {
    // In production, would use tools like Trivy, Clair, etc.
    return {
      image: options.image,
      tag: 'latest',
      digest: '',
      os: 'linux',
      architecture: 'amd64',
      layers: 0,
      size: 0,
      vulnerabilities: [],
      malware: false,
      secrets: 0,
      misconfigurations: []
    };
  }
}

class SecretScanner extends Scanner {
  async scan(options: { path: string }): Promise<{ secrets: SecretDetection[] }> {
    // In production, would use tools like TruffleHog, GitLeaks, etc.
    return { secrets: [] };
  }
}

class LicenseScanner extends Scanner {
  async scan(options: { path: string }): Promise<any> {
    // In production, would analyze package licenses
    return {};
  }
}

class ComplianceScanner extends Scanner {
  async scan(options: { 
    standard: string; 
    path?: string; 
    image?: string 
  }): Promise<ComplianceCheck> {
    // In production, would check against compliance standards
    return {
      standard: options.standard as any,
      version: '1.0',
      passed: true,
      score: 100,
      findings: []
    };
  }
}

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  enforcement: 'block' | 'warn' | 'monitor';
}

interface PolicyRule {
  type: string;
  condition: string;
  action: string;
  severity: string;
}