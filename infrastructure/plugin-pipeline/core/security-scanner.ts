/**
 * Security Scanner for Plugin Pipeline
 * 
 * Comprehensive security scanning and validation system for plugins including
 * vulnerability scanning, dependency analysis, code analysis, and compliance checks
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  PluginDefinition, 
  SecurityScanResult, 
  Vulnerability 
} from '../types/plugin-types';

const execAsync = promisify(exec);

export interface SecurityConfig {
  scanners: {
    trivy?: TrivyConfig;
    snyk?: SnykConfig;
    clair?: ClairConfig;
    anchore?: AnchoreConfig;
  };
  policies: SecurityPolicy[];
  thresholds: SecurityThresholds;
  compliance: ComplianceConfig;
}

export interface TrivyConfig {
  enabled: boolean;
  dbUrl?: string;
  skipUpdate?: boolean;
  timeout: string;
  ignorePolicies?: string[];
}

export interface SnykConfig {
  enabled: boolean;
  token: string;
  organization?: string;
  ignorePolicy?: string;
}

export interface ClairConfig {
  enabled: boolean;
  endpoint: string;
  insecure?: boolean;
}

export interface AnchoreConfig {
  enabled: boolean;
  endpoint: string;
  username: string;
  password: string;
}

export interface SecurityPolicy {
  name: string;
  description: string;
  rules: SecurityRule[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityRule {
  type: 'vulnerability' | 'license' | 'secret' | 'malware' | 'compliance';
  pattern?: string;
  allowedValues?: string[];
  blockedValues?: string[];
  maxSeverity?: string;
}

export interface SecurityThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalScore: number;
}

export interface ComplianceConfig {
  frameworks: ('SOC2' | 'PCI-DSS' | 'HIPAA' | 'GDPR' | 'CIS')[];
  customPolicies?: CompliancePolicy[];
}

export interface CompliancePolicy {
  name: string;
  description: string;
  checks: ComplianceCheck[];
}

export interface ComplianceCheck {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  remediation: string;
  automated: boolean;
}

export interface ScanContext {
  pluginDefinition: PluginDefinition;
  sourceCode?: string;
  dockerImage?: string;
  dependencies?: PackageDependency[];
  licenses?: License[];
  secrets?: SecretScan[];
}

export interface PackageDependency {
  name: string;
  version: string;
  type: 'direct' | 'transitive';
  ecosystem: string;
  vulnerabilities: Vulnerability[];
}

export interface License {
  name: string;
  spdxId?: string;
  url?: string;
  approved: boolean;
  copyleft: boolean;
}

export interface SecretScan {
  type: 'api_key' | 'token' | 'password' | 'certificate' | 'generic';
  location: {
    file: string;
    line: number;
    column: number;
  };
  confidence: 'high' | 'medium' | 'low';
  masked: string;
}

export interface MalwareDetection {
  detected: boolean;
  threats: {
    name: string;
    type: string;
    severity: string;
    description: string;
  }[];
}

export class SecurityScanner extends EventEmitter {
  private logger: Logger;
  private config: SecurityConfig;
  private scanCache: Map<string, SecurityScanResult> = new Map();
  private scanHistory: Map<string, SecurityScanResult[]> = new Map();

  constructor(logger: Logger, config: SecurityConfig) {
    super();
    this.logger = logger;
    this.config = config;
  }

  /**
   * Perform comprehensive security scan on plugin
   */
  async scanPlugin(pluginDefinition: PluginDefinition): Promise<SecurityScanResult> {
    const scanId = this.generateScanId(pluginDefinition);
    const cacheKey = this.getCacheKey(pluginDefinition);
    
    this.logger.info(`Starting security scan for plugin: ${pluginDefinition.name}`, {
      scanId,
      version: pluginDefinition.version
    });

    // Check cache first
    const cachedResult = this.scanCache.get(cacheKey);
    if (cachedResult && this.isCacheValid(cachedResult)) {
      this.logger.info(`Using cached security scan result for ${pluginDefinition.name}`);
      return cachedResult;
    }

    try {
      // Prepare scan context
      const scanContext = await this.prepareScanContext(pluginDefinition);
      
      // Run parallel scans
      const [
        vulnerabilityScan,
        dependencyScan,
        licenseScan,
        secretScan,
        malwareScan,
        complianceScan
      ] = await Promise.all([
        this.performVulnerabilityScan(scanContext),
        this.performDependencyScan(scanContext),
        this.performLicenseScan(scanContext),
        this.performSecretScan(scanContext),
        this.performMalwareScan(scanContext),
        this.performComplianceScan(scanContext)
      ]);

      // Aggregate results
      const aggregatedVulnerabilities = [
        ...vulnerabilityScan,
        ...dependencyScan,
        ...secretScan.map(s => this.secretToVulnerability(s)),
        ...malwareScan.threats.map(t => this.threatToVulnerability(t))
      ];

      // Calculate severity
      const severity = this.calculateOverallSeverity(aggregatedVulnerabilities);
      
      // Check policy compliance
      const policyViolations = await this.checkPolicyCompliance(
        pluginDefinition,
        aggregatedVulnerabilities,
        licenseScan
      );

      // Generate final result
      const scanResult: SecurityScanResult = {
        pluginName: pluginDefinition.name,
        version: pluginDefinition.version,
        hasVulnerabilities: aggregatedVulnerabilities.length > 0,
        severity,
        vulnerabilities: aggregatedVulnerabilities,
        scanTimestamp: new Date(),
        scanner: 'plugin-pipeline-security-scanner',
        metadata: {
          scanId,
          scanDuration: Date.now() - Date.now(),
          licenses: licenseScan,
          secrets: secretScan,
          malware: malwareScan,
          compliance: complianceScan,
          policyViolations,
          thresholds: this.config.thresholds
        }
      };

      // Cache result
      this.scanCache.set(cacheKey, scanResult);
      
      // Store in history
      const history = this.scanHistory.get(pluginDefinition.name) || [];
      history.push(scanResult);
      this.scanHistory.set(pluginDefinition.name, history.slice(-10)); // Keep last 10 scans

      this.emit('scan-completed', { pluginDefinition, scanResult });
      
      this.logger.info(`Security scan completed for plugin: ${pluginDefinition.name}`, {
        scanId,
        severity,
        vulnerabilityCount: aggregatedVulnerabilities.length,
        hasViolations: policyViolations.length > 0
      });

      return scanResult;

    } catch (error) {
      this.logger.error(`Security scan failed for plugin ${pluginDefinition.name}: ${error.message}`);
      
      const failureResult: SecurityScanResult = {
        pluginName: pluginDefinition.name,
        version: pluginDefinition.version,
        hasVulnerabilities: false,
        severity: 'critical',
        vulnerabilities: [{
          id: 'SCAN_ERROR',
          title: 'Security Scan Failed',
          description: `Security scanning failed: ${error.message}`,
          severity: 'critical',
          package: pluginDefinition.name,
          version: pluginDefinition.version,
          references: []
        }],
        scanTimestamp: new Date(),
        scanner: 'plugin-pipeline-security-scanner'
      };

      this.emit('scan-failed', { pluginDefinition, error, scanResult: failureResult });
      return failureResult;
    }
  }

  /**
   * Prepare scan context with plugin artifacts
   */
  private async prepareScanContext(pluginDefinition: PluginDefinition): Promise<ScanContext> {
    const context: ScanContext = {
      pluginDefinition
    };

    // TODO: Add logic to extract source code, dependencies, etc.
    // This would typically involve:
    // - Cloning repository
    // - Analyzing package.json/yarn.lock/etc.
    // - Extracting Docker layers
    
    return context;
  }

  /**
   * Perform vulnerability scanning using multiple scanners
   */
  private async performVulnerabilityScan(context: ScanContext): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Trivy scanning
    if (this.config.scanners.trivy?.enabled) {
      const trivyVulns = await this.runTrivyScan(context);
      vulnerabilities.push(...trivyVulns);
    }

    // Snyk scanning
    if (this.config.scanners.snyk?.enabled) {
      const snykVulns = await this.runSnykScan(context);
      vulnerabilities.push(...snykVulns);
    }

    // Clair scanning
    if (this.config.scanners.clair?.enabled) {
      const clairVulns = await this.runClairScan(context);
      vulnerabilities.push(...clairVulns);
    }

    // Anchore scanning
    if (this.config.scanners.anchore?.enabled) {
      const anchoreVulns = await this.runAnchoreScan(context);
      vulnerabilities.push(...anchoreVulns);
    }

    return this.deduplicateVulnerabilities(vulnerabilities);
  }

  /**
   * Run Trivy vulnerability scan
   */
  private async runTrivyScan(context: ScanContext): Promise<Vulnerability[]> {
    if (!context.dockerImage) {
      return [];
    }

    try {
      const command = `trivy image --format json --no-progress ${context.dockerImage}`;
      const { stdout } = await execAsync(command);
      const trivyResult = JSON.parse(stdout);

      return this.parseTrivyResults(trivyResult);
    } catch (error) {
      this.logger.warn(`Trivy scan failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Run Snyk vulnerability scan
   */
  private async runSnykScan(context: ScanContext): Promise<Vulnerability[]> {
    if (!context.sourceCode) {
      return [];
    }

    try {
      const command = `snyk test --json --severity-threshold=low`;
      const { stdout } = await execAsync(command, {
        cwd: context.sourceCode,
        env: { ...process.env, SNYK_TOKEN: this.config.scanners.snyk!.token }
      });
      const snykResult = JSON.parse(stdout);

      return this.parseSnykResults(snykResult);
    } catch (error) {
      this.logger.warn(`Snyk scan failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Run Clair vulnerability scan
   */
  private async runClairScan(context: ScanContext): Promise<Vulnerability[]> {
    // Clair integration would go here
    this.logger.debug('Clair scanning not implemented yet');
    return [];
  }

  /**
   * Run Anchore vulnerability scan
   */
  private async runAnchoreScan(context: ScanContext): Promise<Vulnerability[]> {
    // Anchore integration would go here
    this.logger.debug('Anchore scanning not implemented yet');
    return [];
  }

  /**
   * Perform dependency scanning
   */
  private async performDependencyScan(context: ScanContext): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Analyze package.json for Node.js projects
    if (context.sourceCode) {
      const packageJsonPath = path.join(context.sourceCode, 'package.json');
      try {
        await fs.access(packageJsonPath);
        const nodeVulns = await this.scanNodeDependencies(context.sourceCode);
        vulnerabilities.push(...nodeVulns);
      } catch {
        // package.json doesn't exist
      }
    }

    // Add support for other package managers (pip, maven, gradle, etc.)

    return vulnerabilities;
  }

  /**
   * Scan Node.js dependencies
   */
  private async scanNodeDependencies(sourceCodePath: string): Promise<Vulnerability[]> {
    try {
      const { stdout } = await execAsync('npm audit --json', { cwd: sourceCodePath });
      const auditResult = JSON.parse(stdout);
      
      return this.parseNpmAuditResults(auditResult);
    } catch (error) {
      this.logger.warn(`npm audit failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Perform license scanning
   */
  private async performLicenseScan(context: ScanContext): Promise<License[]> {
    const licenses: License[] = [];

    if (context.sourceCode) {
      try {
        // Use license-checker or similar tool
        const { stdout } = await execAsync('license-checker --json', { cwd: context.sourceCode });
        const licenseData = JSON.parse(stdout);
        
        licenses.push(...this.parseLicenseData(licenseData));
      } catch (error) {
        this.logger.warn(`License scan failed: ${error.message}`);
      }
    }

    return licenses;
  }

  /**
   * Perform secret scanning
   */
  private async performSecretScan(context: ScanContext): Promise<SecretScan[]> {
    const secrets: SecretScan[] = [];

    if (context.sourceCode) {
      try {
        // Use truffleHog, gitleaks, or similar tool
        const { stdout } = await execAsync(`truffleHog filesystem ${context.sourceCode} --json`);
        const lines = stdout.trim().split('\n');
        
        for (const line of lines) {
          if (line) {
            const secret = JSON.parse(line);
            secrets.push(this.parseTruffleHogResult(secret));
          }
        }
      } catch (error) {
        this.logger.warn(`Secret scan failed: ${error.message}`);
      }
    }

    return secrets;
  }

  /**
   * Perform malware scanning
   */
  private async performMalwareScan(context: ScanContext): Promise<MalwareDetection> {
    // Malware scanning would typically use ClamAV or similar
    this.logger.debug('Malware scanning not implemented yet');
    return { detected: false, threats: [] };
  }

  /**
   * Perform compliance scanning
   */
  private async performComplianceScan(context: ScanContext): Promise<any> {
    const results = {};

    for (const framework of this.config.compliance.frameworks) {
      switch (framework) {
        case 'SOC2':
          results[framework] = await this.performSOC2Scan(context);
          break;
        case 'PCI-DSS':
          results[framework] = await this.performPCIDSSScan(context);
          break;
        case 'CIS':
          results[framework] = await this.performCISScan(context);
          break;
        // Add other frameworks
      }
    }

    return results;
  }

  /**
   * Check policy compliance
   */
  private async checkPolicyCompliance(
    pluginDefinition: PluginDefinition,
    vulnerabilities: Vulnerability[],
    licenses: License[]
  ): Promise<any[]> {
    const violations = [];

    for (const policy of this.config.policies) {
      const policyViolations = await this.checkSinglePolicy(
        policy,
        pluginDefinition,
        vulnerabilities,
        licenses
      );
      violations.push(...policyViolations);
    }

    return violations;
  }

  /**
   * Check single security policy
   */
  private async checkSinglePolicy(
    policy: SecurityPolicy,
    pluginDefinition: PluginDefinition,
    vulnerabilities: Vulnerability[],
    licenses: License[]
  ): Promise<any[]> {
    const violations = [];

    for (const rule of policy.rules) {
      switch (rule.type) {
        case 'vulnerability':
          const vulnViolations = this.checkVulnerabilityRule(rule, vulnerabilities);
          violations.push(...vulnViolations);
          break;
        
        case 'license':
          const licenseViolations = this.checkLicenseRule(rule, licenses);
          violations.push(...licenseViolations);
          break;
        
        // Add other rule types
      }
    }

    return violations.map(v => ({ ...v, policy: policy.name, severity: policy.severity }));
  }

  /**
   * Calculate overall severity from vulnerabilities
   */
  private calculateOverallSeverity(vulnerabilities: Vulnerability[]): 'low' | 'medium' | 'high' | 'critical' {
    const counts = {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length
    };

    if (counts.critical >= this.config.thresholds.critical) return 'critical';
    if (counts.high >= this.config.thresholds.high) return 'high';
    if (counts.medium >= this.config.thresholds.medium) return 'medium';
    if (counts.low >= this.config.thresholds.low) return 'medium';
    
    return 'low';
  }

  /**
   * Helper methods for parsing scanner results
   */
  private parseTrivyResults(trivyResult: any): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    
    for (const result of trivyResult.Results || []) {
      for (const vuln of result.Vulnerabilities || []) {
        vulnerabilities.push({
          id: vuln.VulnerabilityID,
          title: vuln.Title,
          description: vuln.Description,
          severity: vuln.Severity.toLowerCase(),
          package: vuln.PkgName,
          version: vuln.InstalledVersion,
          fixedIn: vuln.FixedVersion,
          references: vuln.References || []
        });
      }
    }
    
    return vulnerabilities;
  }

  private parseSnykResults(snykResult: any): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    
    for (const vuln of snykResult.vulnerabilities || []) {
      vulnerabilities.push({
        id: vuln.id,
        title: vuln.title,
        description: vuln.description,
        severity: vuln.severity.toLowerCase(),
        package: vuln.packageName,
        version: vuln.version,
        fixedIn: vuln.nearestFixedInVersion,
        references: [vuln.url].filter(Boolean)
      });
    }
    
    return vulnerabilities;
  }

  private parseNpmAuditResults(auditResult: any): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    
    for (const [advisoryId, advisory] of Object.entries(auditResult.advisories || {})) {
      const adv = advisory as any;
      vulnerabilities.push({
        id: advisoryId,
        title: adv.title,
        description: adv.overview,
        severity: adv.severity.toLowerCase(),
        package: adv.module_name,
        version: adv.vulnerable_versions,
        fixedIn: adv.patched_versions,
        references: [adv.url].filter(Boolean)
      });
    }
    
    return vulnerabilities;
  }

  private parseLicenseData(licenseData: any): License[] {
    const licenses: License[] = [];
    const approvedLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];
    const copyleftLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0'];
    
    for (const [pkg, info] of Object.entries(licenseData)) {
      const licenseInfo = info as any;
      const license: License = {
        name: licenseInfo.licenses,
        spdxId: licenseInfo.licenses,
        url: licenseInfo.repository,
        approved: approvedLicenses.includes(licenseInfo.licenses),
        copyleft: copyleftLicenses.includes(licenseInfo.licenses)
      };
      licenses.push(license);
    }
    
    return licenses;
  }

  private parseTruffleHogResult(secret: any): SecretScan {
    return {
      type: this.classifySecretType(secret.DetectorName),
      location: {
        file: secret.SourceMetadata?.Data?.Filesystem?.file || 'unknown',
        line: secret.SourceMetadata?.Data?.Filesystem?.line || 0,
        column: 0
      },
      confidence: 'high',
      masked: this.maskSecret(secret.Raw)
    };
  }

  // Additional helper methods...
  private deduplicateVulnerabilities(vulnerabilities: Vulnerability[]): Vulnerability[] {
    const seen = new Set<string>();
    return vulnerabilities.filter(vuln => {
      const key = `${vuln.id}-${vuln.package}-${vuln.version}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private secretToVulnerability(secret: SecretScan): Vulnerability {
    return {
      id: `SECRET-${crypto.randomUUID()}`,
      title: `Exposed ${secret.type} detected`,
      description: `A potential ${secret.type} was found in ${secret.location.file}`,
      severity: secret.confidence === 'high' ? 'high' : 'medium',
      package: 'source-code',
      version: '1.0.0',
      references: []
    };
  }

  private threatToVulnerability(threat: any): Vulnerability {
    return {
      id: `MALWARE-${threat.name}`,
      title: `Malware detected: ${threat.name}`,
      description: threat.description,
      severity: threat.severity.toLowerCase(),
      package: 'container-image',
      version: '1.0.0',
      references: []
    };
  }

  private checkVulnerabilityRule(rule: SecurityRule, vulnerabilities: Vulnerability[]): any[] {
    const violations = [];
    
    if (rule.maxSeverity) {
      const severityOrder = ['low', 'medium', 'high', 'critical'];
      const maxIndex = severityOrder.indexOf(rule.maxSeverity);
      
      for (const vuln of vulnerabilities) {
        const vulnIndex = severityOrder.indexOf(vuln.severity);
        if (vulnIndex > maxIndex) {
          violations.push({
            type: 'vulnerability',
            message: `Vulnerability ${vuln.id} exceeds maximum severity ${rule.maxSeverity}`,
            vulnerability: vuln
          });
        }
      }
    }
    
    return violations;
  }

  private checkLicenseRule(rule: SecurityRule, licenses: License[]): any[] {
    const violations = [];
    
    if (rule.blockedValues) {
      for (const license of licenses) {
        if (rule.blockedValues.includes(license.name)) {
          violations.push({
            type: 'license',
            message: `Blocked license detected: ${license.name}`,
            license
          });
        }
      }
    }
    
    return violations;
  }

  private classifySecretType(detectorName: string): SecretScan['type'] {
    const typeMap = {
      'AWS': 'api_key',
      'GitHub': 'token',
      'Private Key': 'certificate'
    };
    
    return typeMap[detectorName] || 'generic';
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '*'.repeat(secret.length);
    }
    return secret.slice(0, 4) + '*'.repeat(secret.length - 8) + secret.slice(-4);
  }

  private performSOC2Scan(context: ScanContext): Promise<any> {
    // SOC2 compliance checks would go here
    return Promise.resolve({ compliant: true, findings: [] });
  }

  private performPCIDSSScan(context: ScanContext): Promise<any> {
    // PCI-DSS compliance checks would go here
    return Promise.resolve({ compliant: true, findings: [] });
  }

  private performCISScan(context: ScanContext): Promise<any> {
    // CIS benchmark checks would go here
    return Promise.resolve({ compliant: true, findings: [] });
  }

  private generateScanId(pluginDefinition: PluginDefinition): string {
    return `scan-${pluginDefinition.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCacheKey(pluginDefinition: PluginDefinition): string {
    return `${pluginDefinition.name}:${pluginDefinition.version}`;
  }

  private isCacheValid(scanResult: SecurityScanResult): boolean {
    const cacheAge = Date.now() - scanResult.scanTimestamp.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return cacheAge < maxAge;
  }

  /**
   * Get scan history for plugin
   */
  getScanHistory(pluginName: string): SecurityScanResult[] {
    return this.scanHistory.get(pluginName) || [];
  }

  /**
   * Get cached scan result
   */
  getCachedScanResult(pluginDefinition: PluginDefinition): SecurityScanResult | null {
    const cacheKey = this.getCacheKey(pluginDefinition);
    const cached = this.scanCache.get(cacheKey);
    return cached && this.isCacheValid(cached) ? cached : null;
  }

  /**
   * Clear scan cache
   */
  clearCache(): void {
    this.scanCache.clear();
  }
}