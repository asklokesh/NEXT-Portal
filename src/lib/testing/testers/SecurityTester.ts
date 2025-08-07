/**
 * Security Tester
 * Automated security testing with vulnerability scanning and penetration testing
 */

import { EventEmitter } from 'events';
import { TestSuite, TestResult } from '../TestingFramework';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface SecurityTestConfig {
  target: string;
  scanTypes: SecurityScanType[];
  authentication?: AuthConfig;
  excludeUrls?: string[];
  vulnDatabase?: string;
}

export interface SecurityScanType {
  type: 'owasp-zap' | 'nuclei' | 'sqlmap' | 'nmap' | 'ssl-scan' | 'secrets-scan';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface AuthConfig {
  type: 'basic' | 'bearer' | 'form' | 'oauth';
  credentials: Record<string, string>;
  loginUrl?: string;
}

export interface VulnerabilityResult {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  url?: string;
  parameter?: string;
  evidence?: string;
  solution?: string;
  cweId?: string;
  cvssScore?: number;
}

export class SecurityTester extends EventEmitter {
  private vulnerabilityDatabase: Map<string, VulnerabilityResult> = new Map();

  constructor() {
    super();
    this.initializeVulnerabilityDatabase();
  }

  public async execute(suite: TestSuite): Promise<TestResult> {
    this.emit('test:started', suite);
    const startTime = Date.now();

    try {
      const config = this.parseSecurityConfig(suite);
      const results = await this.runSecurityTests(config, suite.id);
      
      const duration = Date.now() - startTime;
      const result = this.createTestResult(suite, results, duration);
      
      this.emit('test:completed', suite, result);
      return result;
    } catch (error) {
      this.emit('test:error', suite, error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Check if security scanning tools are available
      const toolChecks = await Promise.allSettled([
        this.checkTool('zap.sh', 'ZAP'),
        this.checkTool('nuclei', 'nuclei'),
        this.checkTool('nmap', 'nmap')
      ]);

      // At least one tool should be available
      return toolChecks.some(check => check.status === 'fulfilled');
    } catch (error) {
      return false;
    }
  }

  private async runSecurityTests(config: SecurityTestConfig, suiteId: string): Promise<any> {
    const results = {
      vulnerabilities: [] as VulnerabilityResult[],
      scanResults: {} as Record<string, any>,
      summary: {} as any
    };

    for (const scanType of config.scanTypes) {
      if (!scanType.enabled) continue;

      this.emit('test:progress', { suiteId, phase: `security-scan-${scanType.type}` });
      
      try {
        const scanResult = await this.executeScan(scanType, config);
        results.scanResults[scanType.type] = scanResult;
        results.vulnerabilities.push(...scanResult.vulnerabilities);
      } catch (error) {
        results.scanResults[scanType.type] = {
          error: error.message,
          vulnerabilities: []
        };
      }
    }

    // Generate summary
    results.summary = this.generateSecuritySummary(results.vulnerabilities);

    return results;
  }

  private async executeScan(scanType: SecurityScanType, config: SecurityTestConfig): Promise<any> {
    switch (scanType.type) {
      case 'owasp-zap':
        return this.runZAPScan(config, scanType.config);
      case 'nuclei':
        return this.runNucleiScan(config, scanType.config);
      case 'nmap':
        return this.runNmapScan(config, scanType.config);
      case 'ssl-scan':
        return this.runSSLScan(config, scanType.config);
      case 'secrets-scan':
        return this.runSecretscan(config, scanType.config);
      default:
        throw new Error(`Unknown scan type: ${scanType.type}`);
    }
  }

  private async runZAPScan(config: SecurityTestConfig, scanConfig?: any): Promise<any> {
    try {
      // Start ZAP daemon
      const zapCommand = `zap.sh -daemon -port 8080 -config api.disablekey=true`;
      const zapProcess = exec(zapCommand);
      
      // Wait for ZAP to start
      await this.waitForZAP();
      
      // Configure ZAP
      await this.configureZAP(config);
      
      // Run spider scan
      const spiderScanId = await this.startZAPSpider(config.target);
      await this.waitForZAPScan(spiderScanId, 'spider');
      
      // Run active scan
      const activeScanId = await this.startZAPActiveScan(config.target);
      await this.waitForZAPScan(activeScanId, 'ascan');
      
      // Get results
      const vulnerabilities = await this.getZAPVulnerabilities();
      
      // Stop ZAP
      zapProcess.kill();
      
      return { vulnerabilities };
    } catch (error) {
      throw new Error(`ZAP scan failed: ${error.message}`);
    }
  }

  private async waitForZAP(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        await axios.get('http://localhost:8080/JSON/core/view/version/');
        return;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('ZAP failed to start');
  }

  private async configureZAP(config: SecurityTestConfig): Promise<void> {
    // Configure ZAP settings
    if (config.authentication) {
      await this.configureZAPAuth(config.authentication);
    }
    
    if (config.excludeUrls) {
      for (const url of config.excludeUrls) {
        await axios.get(`http://localhost:8080/JSON/core/action/excludeFromProxy/?regex=${encodeURIComponent(url)}`);
      }
    }
  }

  private async configureZAPAuth(auth: AuthConfig): Promise<void> {
    switch (auth.type) {
      case 'basic':
        await axios.get(`http://localhost:8080/JSON/httpSessions/action/createSession/?site=${encodeURIComponent('localhost')}&session=auth`);
        break;
      case 'form':
        if (auth.loginUrl && auth.credentials.username && auth.credentials.password) {
          const formData = new URLSearchParams();
          formData.append('username', auth.credentials.username);
          formData.append('password', auth.credentials.password);
          
          await axios.post(auth.loginUrl, formData);
        }
        break;
    }
  }

  private async startZAPSpider(target: string): Promise<string> {
    const response = await axios.get(`http://localhost:8080/JSON/spider/action/scan/?url=${encodeURIComponent(target)}`);
    return response.data.scan;
  }

  private async startZAPActiveScan(target: string): Promise<string> {
    const response = await axios.get(`http://localhost:8080/JSON/ascan/action/scan/?url=${encodeURIComponent(target)}`);
    return response.data.scan;
  }

  private async waitForZAPScan(scanId: string, scanType: 'spider' | 'ascan'): Promise<void> {
    let progress = 0;
    
    while (progress < 100) {
      const response = await axios.get(`http://localhost:8080/JSON/${scanType}/view/status/?scanId=${scanId}`);
      progress = parseInt(response.data.status);
      
      this.emit('scan:progress', { scanType, scanId, progress });
      
      if (progress < 100) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async getZAPVulnerabilities(): Promise<VulnerabilityResult[]> {
    const response = await axios.get('http://localhost:8080/JSON/core/view/alerts/');
    const alerts = response.data.alerts;
    
    return alerts.map((alert: any) => ({
      id: `zap-${alert.alertRef}`,
      severity: this.mapZAPSeverity(alert.risk),
      title: alert.alert,
      description: alert.description,
      url: alert.url,
      parameter: alert.param,
      evidence: alert.evidence,
      solution: alert.solution,
      cweId: alert.cweid,
      cvssScore: alert.riskdesc ? this.extractCVSSScore(alert.riskdesc) : undefined
    }));
  }

  private async runNucleiScan(config: SecurityTestConfig, scanConfig?: any): Promise<any> {
    try {
      const command = `nuclei -u ${config.target} -json -silent`;
      const { stdout } = await execAsync(command, { timeout: 300000 }); // 5 minute timeout
      
      const vulnerabilities = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            const result = JSON.parse(line);
            return {
              id: `nuclei-${result.templateID}`,
              severity: this.mapNucleiSeverity(result.info?.severity || 'info'),
              title: result.info?.name || result.templateID,
              description: result.info?.description || '',
              url: result.matched_at,
              solution: result.info?.remediation,
              cweId: result.info?.classification?.['cwe-id']?.[0]
            };
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean) as VulnerabilityResult[];
      
      return { vulnerabilities };
    } catch (error) {
      throw new Error(`Nuclei scan failed: ${error.message}`);
    }
  }

  private async runNmapScan(config: SecurityTestConfig, scanConfig?: any): Promise<any> {
    try {
      const target = new URL(config.target).hostname;
      const command = `nmap -sV -sC --script vuln -oX - ${target}`;
      const { stdout } = await execAsync(command, { timeout: 600000 }); // 10 minute timeout
      
      // Parse nmap XML output (simplified)
      const vulnerabilities = this.parseNmapXML(stdout);
      
      return { vulnerabilities };
    } catch (error) {
      throw new Error(`Nmap scan failed: ${error.message}`);
    }
  }

  private async runSSLScan(config: SecurityTestConfig, scanConfig?: any): Promise<any> {
    try {
      const target = new URL(config.target);
      const hostname = target.hostname;
      const port = target.port || (target.protocol === 'https:' ? '443' : '80');
      
      const command = `testssl.sh --jsonfile-pretty - ${hostname}:${port}`;
      const { stdout } = await execAsync(command, { timeout: 180000 }); // 3 minute timeout
      
      const sslResults = JSON.parse(stdout);
      const vulnerabilities = this.parseSSLResults(sslResults);
      
      return { vulnerabilities };
    } catch (error) {
      // If testssl.sh is not available, do a basic SSL check
      return this.basicSSLCheck(config.target);
    }
  }

  private async runSecretscan(config: SecurityTestConfig, scanConfig?: any): Promise<any> {
    try {
      // Scan for exposed secrets in the application
      const response = await axios.get(`${config.target}/robots.txt`, { 
        validateStatus: () => true 
      });
      
      const vulnerabilities: VulnerabilityResult[] = [];
      
      // Check for exposed sensitive files
      const sensitiveFiles = [
        '/.env',
        '/config.json',
        '/secrets.json',
        '/.git/config',
        '/backup.sql',
        '/database.dump'
      ];
      
      for (const file of sensitiveFiles) {
        try {
          const fileResponse = await axios.get(`${config.target}${file}`, {
            validateStatus: () => true,
            timeout: 5000
          });
          
          if (fileResponse.status === 200) {
            vulnerabilities.push({
              id: `secrets-exposed-file-${file.replace(/[^a-zA-Z0-9]/g, '-')}`,
              severity: 'high',
              title: `Exposed Sensitive File: ${file}`,
              description: `Sensitive file ${file} is publicly accessible`,
              url: `${config.target}${file}`,
              solution: 'Remove or restrict access to sensitive files'
            });
          }
        } catch (error) {
          // File not accessible, which is good
        }
      }
      
      return { vulnerabilities };
    } catch (error) {
      throw new Error(`Secrets scan failed: ${error.message}`);
    }
  }

  private async checkTool(command: string, toolName: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  private mapZAPSeverity(zapRisk: string): VulnerabilityResult['severity'] {
    switch (zapRisk.toLowerCase()) {
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      case 'informational': return 'info';
      default: return 'info';
    }
  }

  private mapNucleiSeverity(nucleiSeverity: string): VulnerabilityResult['severity'] {
    switch (nucleiSeverity.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      case 'info': return 'info';
      default: return 'info';
    }
  }

  private extractCVSSScore(riskDesc: string): number | undefined {
    const cvssMatch = riskDesc.match(/CVSS:(\d+(?:\.\d+)?)/);
    return cvssMatch ? parseFloat(cvssMatch[1]) : undefined;
  }

  private parseNmapXML(xmlOutput: string): VulnerabilityResult[] {
    // Simplified XML parsing - in production, use proper XML parser
    const vulnerabilities: VulnerabilityResult[] = [];
    
    const scriptOutputRegex = /<script id="(.*?)" output="(.*?)"/g;
    let match;
    
    while ((match = scriptOutputRegex.exec(xmlOutput)) !== null) {
      const scriptId = match[1];
      const output = match[2];
      
      if (scriptId.includes('vuln') || output.includes('VULNERABLE')) {
        vulnerabilities.push({
          id: `nmap-${scriptId}`,
          severity: 'medium',
          title: `Nmap Vulnerability: ${scriptId}`,
          description: output,
          solution: 'Review and patch the identified vulnerability'
        });
      }
    }
    
    return vulnerabilities;
  }

  private parseSSLResults(sslResults: any): VulnerabilityResult[] {
    const vulnerabilities: VulnerabilityResult[] = [];
    
    // Parse SSL/TLS vulnerabilities from testssl.sh results
    if (sslResults.vulnerabilities) {
      sslResults.vulnerabilities.forEach((vuln: any) => {
        vulnerabilities.push({
          id: `ssl-${vuln.id}`,
          severity: this.mapSSLSeverity(vuln.severity),
          title: vuln.title,
          description: vuln.finding,
          solution: 'Update SSL/TLS configuration and certificates'
        });
      });
    }
    
    return vulnerabilities;
  }

  private async basicSSLCheck(target: string): Promise<{ vulnerabilities: VulnerabilityResult[] }> {
    const vulnerabilities: VulnerabilityResult[] = [];
    
    try {
      const response = await axios.get(target, {
        timeout: 10000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });
      
      // Basic SSL checks
      if (target.startsWith('https:')) {
        const cert = response.request.connection?.getPeerCertificate?.();
        
        if (cert && cert.valid_to) {
          const expirationDate = new Date(cert.valid_to);
          const daysUntilExpiration = Math.floor((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiration < 30) {
            vulnerabilities.push({
              id: 'ssl-cert-expiration',
              severity: daysUntilExpiration < 7 ? 'high' : 'medium',
              title: 'SSL Certificate Near Expiration',
              description: `SSL certificate expires in ${daysUntilExpiration} days`,
              solution: 'Renew SSL certificate before expiration'
            });
          }
        }
      } else {
        vulnerabilities.push({
          id: 'ssl-not-enforced',
          severity: 'medium',
          title: 'HTTPS Not Enforced',
          description: 'Application is not using HTTPS',
          solution: 'Implement HTTPS and redirect HTTP traffic'
        });
      }
    } catch (error) {
      // SSL check failed
    }
    
    return { vulnerabilities };
  }

  private mapSSLSeverity(severity: string): VulnerabilityResult['severity'] {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'info';
    }
  }

  private generateSecuritySummary(vulnerabilities: VulnerabilityResult[]): any {
    const summary = {
      total: vulnerabilities.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    vulnerabilities.forEach(vuln => {
      summary[vuln.severity]++;
    });

    return summary;
  }

  private parseSecurityConfig(suite: TestSuite): SecurityTestConfig {
    return {
      target: suite.config?.target || 'http://localhost:4400',
      scanTypes: suite.config?.scanTypes || [
        { type: 'owasp-zap', enabled: true },
        { type: 'nuclei', enabled: true },
        { type: 'ssl-scan', enabled: true },
        { type: 'secrets-scan', enabled: true }
      ],
      authentication: suite.config?.authentication,
      excludeUrls: suite.config?.excludeUrls || [],
      vulnDatabase: suite.config?.vulnDatabase
    };
  }

  private createTestResult(suite: TestSuite, results: any, duration: number): TestResult {
    const vulnerabilities = results.vulnerabilities || [];
    const criticalVulns = vulnerabilities.filter((v: VulnerabilityResult) => v.severity === 'critical');
    const hasBlockingVulns = criticalVulns.length > 0;

    return {
      suiteId: suite.id,
      status: hasBlockingVulns ? 'failed' : 'passed',
      duration,
      security: {
        vulnerabilities: results.summary,
        compliance: {
          score: this.calculateComplianceScore(vulnerabilities),
          passed: vulnerabilities.filter((v: VulnerabilityResult) => 
            v.severity === 'info' || v.severity === 'low').length,
          failed: vulnerabilities.filter((v: VulnerabilityResult) => 
            v.severity === 'critical' || v.severity === 'high').length
        },
        threats: vulnerabilities
          .filter((v: VulnerabilityResult) => v.severity === 'critical' || v.severity === 'high')
          .map((v: VulnerabilityResult) => v.title)
      },
      errors: criticalVulns.map((vuln: VulnerabilityResult) => ({
        message: vuln.title,
        type: 'SecurityVulnerability'
      })),
      metrics: {
        executionTime: duration,
        memoryUsage: 0,
        cpuUsage: 0,
        networkCalls: results.summary?.total || 0,
        databaseQueries: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      timestamp: new Date(),
      artifacts: [
        `security-report-${suite.id}-${Date.now()}.json`,
        `vulnerability-report-${suite.id}-${Date.now()}.json`
      ]
    };
  }

  private calculateComplianceScore(vulnerabilities: VulnerabilityResult[]): number {
    if (vulnerabilities.length === 0) return 100;
    
    const weights = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
    const totalWeight = vulnerabilities.reduce((sum, vuln) => 
      sum + (weights[vuln.severity] || 0), 0);
    
    const maxPossibleWeight = vulnerabilities.length * weights.critical;
    return Math.max(0, 100 - (totalWeight / maxPossibleWeight) * 100);
  }

  private initializeVulnerabilityDatabase(): void {
    // Initialize with common vulnerabilities
    // This would typically load from external vulnerability databases
  }
}

export default SecurityTester;