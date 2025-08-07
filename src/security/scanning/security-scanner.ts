/**
 * Security Scanning and Compliance Framework
 * Implements comprehensive security scanning, vulnerability assessment,
 * and compliance validation for plugins and infrastructure
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import { AuditLogger } from '../logging/audit-logger';
import { ThreatDetector } from '../detection/threat-detector';

// Security Scanning Schema Definitions
export const VulnerabilitySchema = z.object({
  vulnerabilityId: z.string().uuid(),
  type: z.enum([
    'code_injection', 'xss', 'csrf', 'sql_injection', 'path_traversal',
    'insecure_deserialization', 'broken_authentication', 'sensitive_data_exposure',
    'xml_external_entities', 'broken_access_control', 'security_misconfiguration',
    'known_vulnerable_components', 'insufficient_logging', 'server_side_request_forgery',
    'container_vulnerability', 'secrets_exposure', 'weak_cryptography'
  ]),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  solution: z.string(),
  references: z.array(z.string()),
  cwe: z.string().optional(), // Common Weakness Enumeration
  cve: z.string().optional(), // Common Vulnerabilities and Exposures
  cvss: z.object({
    version: z.string(),
    vectorString: z.string(),
    baseScore: z.number().min(0).max(10),
    temporalScore: z.number().min(0).max(10).optional(),
    environmentalScore: z.number().min(0).max(10).optional()
  }).optional(),
  location: z.object({
    file: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
    function: z.string().optional(),
    component: z.string().optional()
  }),
  evidence: z.object({
    code: z.string().optional(),
    request: z.string().optional(),
    response: z.string().optional(),
    payload: z.string().optional()
  }).optional(),
  remediation: z.object({
    effort: z.enum(['trivial', 'easy', 'medium', 'hard']),
    confidence: z.enum(['low', 'medium', 'high']),
    steps: z.array(z.string()),
    resources: z.array(z.string()).optional()
  }),
  status: z.enum(['new', 'triaged', 'in_progress', 'resolved', 'false_positive', 'wont_fix']),
  discoveredAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().optional(),
  metadata: z.record(z.any())
});

export const ScanConfigSchema = z.object({
  scanId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['sast', 'dast', 'iast', 'container', 'infrastructure', 'dependency', 'secrets', 'compliance']),
  scope: z.object({
    targets: z.array(z.string()), // URLs, paths, container images, etc.
    exclusions: z.array(z.string()).optional(),
    depth: z.number().min(1).max(10).optional(),
    timeout: z.number().min(1).max(3600).optional() // seconds
  }),
  schedule: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
    time: z.string().optional(), // HH:MM format
    timezone: z.string().optional()
  }).optional(),
  options: z.object({
    authentication: z.object({
      type: z.enum(['none', 'basic', 'oauth', 'api_key', 'certificate']),
      credentials: z.record(z.string()).optional()
    }).optional(),
    performance: z.object({
      maxConcurrency: z.number().min(1).max(50).optional(),
      requestDelay: z.number().min(0).max(5000).optional(), // milliseconds
      userAgent: z.string().optional()
    }).optional(),
    rules: z.object({
      enabled: z.array(z.string()).optional(),
      disabled: z.array(z.string()).optional(),
      severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional()
    }).optional()
  }).optional(),
  notifications: z.object({
    onComplete: z.boolean().default(true),
    onHighSeverity: z.boolean().default(true),
    channels: z.array(z.enum(['email', 'slack', 'webhook', 'sms']))
  }).optional(),
  compliance: z.object({
    frameworks: z.array(z.enum(['OWASP_TOP10', 'CIS', 'NIST', 'ISO27001', 'SOC2', 'GDPR', 'HIPAA'])),
    requirements: z.array(z.string()).optional()
  }).optional(),
  createdAt: z.date(),
  createdBy: z.string(),
  isActive: z.boolean()
});

export const ScanResultSchema = z.object({
  resultId: z.string().uuid(),
  scanId: z.string().uuid(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().optional(), // milliseconds
  summary: z.object({
    totalTargets: z.number(),
    scannedTargets: z.number(),
    vulnerabilities: z.object({
      total: z.number(),
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
      info: z.number()
    }),
    coverage: z.object({
      linesOfCode: z.number().optional(),
      functions: z.number().optional(),
      files: z.number().optional(),
      endpoints: z.number().optional()
    }).optional()
  }),
  vulnerabilities: z.array(z.string().uuid()),
  performance: z.object({
    averageResponseTime: z.number().optional(),
    totalRequests: z.number().optional(),
    failedRequests: z.number().optional(),
    bytesTransferred: z.number().optional()
  }).optional(),
  compliance: z.object({
    framework: z.string(),
    score: z.number().min(0).max(100),
    passed: z.number(),
    failed: z.number(),
    details: z.array(z.object({
      requirement: z.string(),
      status: z.enum(['pass', 'fail', 'not_applicable']),
      evidence: z.string().optional()
    }))
  }).optional(),
  artifacts: z.array(z.object({
    type: z.enum(['report', 'log', 'screenshot', 'evidence']),
    format: z.enum(['json', 'xml', 'html', 'pdf', 'csv']),
    path: z.string(),
    size: z.number(),
    checksum: z.string()
  })).optional(),
  metadata: z.record(z.any()),
  error: z.string().optional()
});

export type Vulnerability = z.infer<typeof VulnerabilitySchema>;
export type ScanConfig = z.infer<typeof ScanConfigSchema>;
export type ScanResult = z.infer<typeof ScanResultSchema>;

export interface ScannerPlugin {
  name: string;
  version: string;
  type: ScanConfig['type'];
  initialize(config: any): Promise<void>;
  scan(targets: string[], options: any): Promise<Vulnerability[]>;
  isAvailable(): Promise<boolean>;
  getInfo(): {
    capabilities: string[];
    supportedLanguages?: string[];
    supportedFormats?: string[];
  };
}

export interface ComplianceRule {
  ruleId: string;
  framework: string;
  requirement: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (target: any, context: any) => Promise<{
    passed: boolean;
    evidence?: string;
    message?: string;
  }>;
}

export class SecurityScanner {
  private scanConfigs: Map<string, ScanConfig> = new Map();
  private scanResults: Map<string, ScanResult> = new Map();
  private vulnerabilities: Map<string, Vulnerability> = new Map();
  private scannerPlugins: Map<string, ScannerPlugin> = new Map();
  private complianceRules: Map<string, ComplianceRule> = new Map();
  private auditLogger: AuditLogger;
  private threatDetector: ThreatDetector;
  private activeScanJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.auditLogger = new AuditLogger();
    this.threatDetector = new ThreatDetector();
    this.initializeDefaultScanners();
    this.initializeComplianceRules();
  }

  /**
   * Create a new scan configuration
   */
  async createScanConfig(configData: Omit<ScanConfig, 'scanId' | 'createdAt' | 'isActive'>): Promise<ScanConfig> {
    const scanConfig: ScanConfig = {
      scanId: crypto.randomUUID(),
      ...configData,
      createdAt: new Date(),
      isActive: true
    };

    // Validate configuration
    const validationResult = ScanConfigSchema.safeParse(scanConfig);
    if (!validationResult.success) {
      throw new Error(`Invalid scan configuration: ${validationResult.error.message}`);
    }

    // Store configuration
    this.scanConfigs.set(scanConfig.scanId, scanConfig);

    // Schedule scan if configured
    if (scanConfig.schedule?.enabled) {
      await this.scheduleScan(scanConfig);
    }

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SCAN_CONFIG_CREATED',
      scanId: scanConfig.scanId,
      details: {
        name: scanConfig.name,
        type: scanConfig.type,
        targetsCount: scanConfig.scope.targets.length
      }
    });

    return scanConfig;
  }

  /**
   * Execute a security scan
   */
  async executeScan(scanId: string, overrides?: Partial<ScanConfig['options']>): Promise<ScanResult> {
    const scanConfig = this.scanConfigs.get(scanId);
    if (!scanConfig || !scanConfig.isActive) {
      throw new Error('Scan configuration not found or inactive');
    }

    const resultId = crypto.randomUUID();
    const startTime = new Date();

    // Initialize scan result
    const scanResult: ScanResult = {
      resultId,
      scanId,
      status: 'running',
      startTime,
      summary: {
        totalTargets: scanConfig.scope.targets.length,
        scannedTargets: 0,
        vulnerabilities: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0
        }
      },
      vulnerabilities: [],
      metadata: {}
    };

    this.scanResults.set(resultId, scanResult);

    // Audit log
    await this.auditLogger.logSecurityEvent({
      eventType: 'SCAN_STARTED',
      scanId,
      resultId,
      details: {
        type: scanConfig.type,
        targets: scanConfig.scope.targets,
        overrides
      }
    });

    try {
      // Execute scan based on type
      const foundVulnerabilities = await this.performScan(scanConfig, overrides);

      // Store vulnerabilities
      for (const vulnerability of foundVulnerabilities) {
        this.vulnerabilities.set(vulnerability.vulnerabilityId, vulnerability);
        scanResult.vulnerabilities.push(vulnerability.vulnerabilityId);
        
        // Update summary
        scanResult.summary.vulnerabilities.total++;
        scanResult.summary.vulnerabilities[vulnerability.severity]++;
      }

      // Run compliance checks if configured
      let complianceResult;
      if (scanConfig.compliance) {
        complianceResult = await this.runComplianceChecks(scanConfig, foundVulnerabilities);
        scanResult.compliance = complianceResult;
      }

      // Complete scan result
      const endTime = new Date();
      scanResult.status = 'completed';
      scanResult.endTime = endTime;
      scanResult.duration = endTime.getTime() - startTime.getTime();
      scanResult.summary.scannedTargets = scanConfig.scope.targets.length;

      this.scanResults.set(resultId, scanResult);

      // Send notifications
      if (scanConfig.notifications) {
        await this.sendScanNotifications(scanConfig, scanResult);
      }

      // Check for critical vulnerabilities and trigger threat response
      const criticalVulns = foundVulnerabilities.filter(v => v.severity === 'critical');
      if (criticalVulns.length > 0) {
        await this.handleCriticalVulnerabilities(scanConfig, criticalVulns);
      }

      // Audit log
      await this.auditLogger.logSecurityEvent({
        eventType: 'SCAN_COMPLETED',
        scanId,
        resultId,
        details: {
          duration: scanResult.duration,
          vulnerabilities: scanResult.summary.vulnerabilities,
          complianceScore: complianceResult?.score
        }
      });

      return scanResult;
    } catch (error) {
      // Handle scan failure
      scanResult.status = 'failed';
      scanResult.endTime = new Date();
      scanResult.error = error.message;
      
      this.scanResults.set(resultId, scanResult);

      await this.auditLogger.logSecurityEvent({
        eventType: 'SCAN_FAILED',
        scanId,
        resultId,
        error: error.message,
        details: { type: scanConfig.type }
      });

      throw new Error(`Scan failed: ${error.message}`);
    }
  }

  /**
   * Perform continuous security monitoring
   */
  async startContinuousMonitoring(targets: string[], options: {
    interval: number; // minutes
    alertThreshold: 'low' | 'medium' | 'high' | 'critical';
    autoRemediate: boolean;
  }): Promise<string> {
    const monitoringId = crypto.randomUUID();

    const monitor = async () => {
      try {
        // Create temporary scan config for monitoring
        const scanConfig: ScanConfig = {
          scanId: crypto.randomUUID(),
          name: `Continuous Monitoring - ${monitoringId}`,
          type: 'infrastructure',
          scope: { targets },
          createdAt: new Date(),
          createdBy: 'system',
          isActive: true
        };

        const result = await this.executeScan(scanConfig.scanId);
        
        // Check for new vulnerabilities above threshold
        const severityLevels = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
        const thresholdLevel = severityLevels[options.alertThreshold];
        
        const alertVulns = result.vulnerabilities
          .map(id => this.vulnerabilities.get(id))
          .filter(v => v && severityLevels[v.severity] >= thresholdLevel);

        if (alertVulns.length > 0) {
          await this.handleMonitoringAlert(monitoringId, alertVulns as Vulnerability[], options);
        }
      } catch (error) {
        await this.auditLogger.logSecurityEvent({
          eventType: 'MONITORING_ERROR',
          monitoringId,
          error: error.message
        });
      }
    };

    // Schedule recurring monitoring
    const intervalMs = options.interval * 60 * 1000;
    const job = setInterval(monitor, intervalMs);
    this.activeScanJobs.set(monitoringId, job);

    // Run initial scan
    await monitor();

    await this.auditLogger.logSecurityEvent({
      eventType: 'CONTINUOUS_MONITORING_STARTED',
      monitoringId,
      details: {
        targets: targets.length,
        interval: options.interval,
        alertThreshold: options.alertThreshold
      }
    });

    return monitoringId;
  }

  /**
   * Stop continuous monitoring
   */
  async stopContinuousMonitoring(monitoringId: string): Promise<void> {
    const job = this.activeScanJobs.get(monitoringId);
    if (job) {
      clearInterval(job);
      this.activeScanJobs.delete(monitoringId);

      await this.auditLogger.logSecurityEvent({
        eventType: 'CONTINUOUS_MONITORING_STOPPED',
        monitoringId
      });
    }
  }

  /**
   * Get scan result with vulnerabilities
   */
  getScanResult(resultId: string): (ScanResult & { vulnerabilityDetails?: Vulnerability[] }) | undefined {
    const result = this.scanResults.get(resultId);
    if (!result) return undefined;

    const vulnerabilityDetails = result.vulnerabilities
      .map(id => this.vulnerabilities.get(id))
      .filter(Boolean) as Vulnerability[];

    return {
      ...result,
      vulnerabilityDetails
    };
  }

  /**
   * Get vulnerability by ID
   */
  getVulnerability(vulnerabilityId: string): Vulnerability | undefined {
    return this.vulnerabilities.get(vulnerabilityId);
  }

  /**
   * Update vulnerability status
   */
  async updateVulnerability(
    vulnerabilityId: string,
    updates: Partial<Pick<Vulnerability, 'status' | 'remediation' | 'metadata'>>,
    updatedBy: string
  ): Promise<Vulnerability> {
    const vulnerability = this.vulnerabilities.get(vulnerabilityId);
    if (!vulnerability) {
      throw new Error('Vulnerability not found');
    }

    const updatedVulnerability: Vulnerability = {
      ...vulnerability,
      ...updates,
      updatedAt: new Date()
    };

    if (updates.status === 'resolved') {
      updatedVulnerability.resolvedAt = new Date();
    }

    this.vulnerabilities.set(vulnerabilityId, updatedVulnerability);

    await this.auditLogger.logSecurityEvent({
      eventType: 'VULNERABILITY_UPDATED',
      vulnerabilityId,
      details: {
        changes: updates,
        updatedBy,
        severity: vulnerability.severity
      }
    });

    return updatedVulnerability;
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(options: {
    scanIds?: string[];
    timeRange?: { from: Date; to: Date };
    format: 'json' | 'html' | 'pdf';
    includeCompliance?: boolean;
    includeRemediation?: boolean;
  }): Promise<{
    reportId: string;
    generatedAt: Date;
    summary: {
      totalScans: number;
      totalVulnerabilities: number;
      riskScore: number;
      complianceScore?: number;
      trends: {
        newVulnerabilities: number;
        resolvedVulnerabilities: number;
        riskTrend: 'improving' | 'degrading' | 'stable';
      };
    };
    details: {
      scanResults: ScanResult[];
      vulnerabilities: Vulnerability[];
      compliance?: any;
      recommendations: string[];
    };
    artifacts?: {
      reportPath: string;
      format: string;
      size: number;
    };
  }> {
    const reportId = crypto.randomUUID();
    const generatedAt = new Date();

    // Filter scan results based on criteria
    let scanResults = Array.from(this.scanResults.values());
    
    if (options.scanIds) {
      scanResults = scanResults.filter(r => options.scanIds!.includes(r.scanId));
    }
    
    if (options.timeRange) {
      scanResults = scanResults.filter(r => 
        r.startTime >= options.timeRange!.from && 
        r.startTime <= options.timeRange!.to
      );
    }

    // Get associated vulnerabilities
    const vulnerabilityIds = new Set<string>();
    scanResults.forEach(result => {
      result.vulnerabilities.forEach(id => vulnerabilityIds.add(id));
    });

    const vulnerabilities = Array.from(vulnerabilityIds)
      .map(id => this.vulnerabilities.get(id))
      .filter(Boolean) as Vulnerability[];

    // Calculate metrics
    const totalVulnerabilities = vulnerabilities.length;
    const riskScore = this.calculateRiskScore(vulnerabilities);
    const complianceScore = options.includeCompliance ? 
      this.calculateComplianceScore(scanResults) : undefined;

    // Generate trends
    const trends = this.calculateSecurityTrends(scanResults, vulnerabilities);

    // Generate recommendations
    const recommendations = this.generateSecurityRecommendations(vulnerabilities);

    const report = {
      reportId,
      generatedAt,
      summary: {
        totalScans: scanResults.length,
        totalVulnerabilities,
        riskScore,
        complianceScore,
        trends
      },
      details: {
        scanResults,
        vulnerabilities,
        recommendations
      }
    };

    // Generate report artifact if requested
    let artifacts;
    if (options.format !== 'json') {
      artifacts = await this.generateReportArtifact(report, options.format);
    }

    await this.auditLogger.logSecurityEvent({
      eventType: 'SECURITY_REPORT_GENERATED',
      reportId,
      details: {
        format: options.format,
        totalScans: scanResults.length,
        totalVulnerabilities,
        riskScore
      }
    });

    return { ...report, artifacts };
  }

  /**
   * Register a scanner plugin
   */
  registerScannerPlugin(plugin: ScannerPlugin): void {
    this.scannerPlugins.set(plugin.name, plugin);
  }

  /**
   * Register compliance rules
   */
  registerComplianceRules(rules: ComplianceRule[]): void {
    rules.forEach(rule => {
      this.complianceRules.set(rule.ruleId, rule);
    });
  }

  /**
   * Get security metrics dashboard data
   */
  getSecurityMetrics(): {
    overview: {
      totalScans: number;
      activeConfigurations: number;
      totalVulnerabilities: number;
      criticalVulnerabilities: number;
      riskScore: number;
      complianceScore: number;
    };
    trends: {
      scanFrequency: { period: string; count: number }[];
      vulnerabilityTrends: { period: string; count: number; severity: string }[];
      riskTrends: { period: string; score: number }[];
    };
    topVulnerabilities: {
      type: string;
      count: number;
      severity: string;
    }[];
    complianceStatus: {
      framework: string;
      score: number;
      requirements: { total: number; passed: number; failed: number };
    }[];
  } {
    const activeConfigs = Array.from(this.scanConfigs.values()).filter(c => c.isActive);
    const allVulnerabilities = Array.from(this.vulnerabilities.values());
    const criticalVulns = allVulnerabilities.filter(v => v.severity === 'critical');
    
    return {
      overview: {
        totalScans: this.scanResults.size,
        activeConfigurations: activeConfigs.length,
        totalVulnerabilities: allVulnerabilities.length,
        criticalVulnerabilities: criticalVulns.length,
        riskScore: this.calculateRiskScore(allVulnerabilities),
        complianceScore: this.calculateOverallComplianceScore()
      },
      trends: this.calculateMetricsTrends(),
      topVulnerabilities: this.getTopVulnerabilities(),
      complianceStatus: this.getComplianceStatus()
    };
  }

  // Private helper methods
  private async initializeDefaultScanners(): Promise<void> {
    // Register built-in scanner plugins
    const staticAnalysisScanner: ScannerPlugin = {
      name: 'static-analysis',
      version: '1.0.0',
      type: 'sast',
      async initialize() {},
      async scan(targets, options) {
        return this.performStaticAnalysis(targets, options);
      },
      async isAvailable() { return true; },
      getInfo() {
        return {
          capabilities: ['javascript', 'typescript', 'python', 'java'],
          supportedLanguages: ['js', 'ts', 'py', 'java'],
          supportedFormats: ['json', 'sarif']
        };
      }
    };

    this.registerScannerPlugin(staticAnalysisScanner);
  }

  private async initializeComplianceRules(): Promise<void> {
    // Initialize OWASP Top 10 rules
    const owaspRules: ComplianceRule[] = [
      {
        ruleId: 'owasp-a01-broken-access-control',
        framework: 'OWASP_TOP10',
        requirement: 'A01:2021 - Broken Access Control',
        category: 'access_control',
        description: 'Verify proper access controls are implemented',
        severity: 'high',
        async check(target, context) {
          // Mock implementation
          return { passed: Math.random() > 0.3 };
        }
      },
      {
        ruleId: 'owasp-a02-cryptographic-failures',
        framework: 'OWASP_TOP10',
        requirement: 'A02:2021 - Cryptographic Failures',
        category: 'cryptography',
        description: 'Verify cryptographic implementations',
        severity: 'high',
        async check(target, context) {
          return { passed: Math.random() > 0.2 };
        }
      }
    ];

    this.registerComplianceRules(owaspRules);
  }

  private async performScan(config: ScanConfig, overrides?: any): Promise<Vulnerability[]> {
    const scanner = this.scannerPlugins.get(config.type) || 
                   Array.from(this.scannerPlugins.values()).find(s => s.type === config.type);

    if (!scanner || !(await scanner.isAvailable())) {
      throw new Error(`Scanner for type ${config.type} not available`);
    }

    const mergedOptions = { ...config.options, ...overrides };
    const vulnerabilities = await scanner.scan(config.scope.targets, mergedOptions);

    // Enrich vulnerabilities with additional metadata
    return vulnerabilities.map(vuln => ({
      ...vuln,
      discoveredAt: new Date(),
      updatedAt: new Date(),
      status: 'new' as const,
      metadata: {
        ...vuln.metadata,
        scanId: config.scanId,
        scanner: scanner.name
      }
    }));
  }

  private async performStaticAnalysis(targets: string[], options: any): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Mock static analysis implementation
    for (const target of targets) {
      // Simulate finding vulnerabilities
      if (Math.random() > 0.7) {
        const vulnerability: Vulnerability = {
          vulnerabilityId: crypto.randomUUID(),
          type: ['code_injection', 'xss', 'sql_injection'][Math.floor(Math.random() * 3)] as any,
          severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
          title: 'Potential Security Vulnerability',
          description: 'Static analysis detected a potential security issue',
          impact: 'Could lead to security compromise',
          solution: 'Review and fix the identified code pattern',
          references: ['https://owasp.org'],
          location: {
            file: target,
            line: Math.floor(Math.random() * 100),
            function: 'vulnerableFunction'
          },
          remediation: {
            effort: 'medium',
            confidence: 'high',
            steps: ['Review code', 'Apply fix', 'Test changes']
          },
          status: 'new',
          discoveredAt: new Date(),
          updatedAt: new Date(),
          metadata: {}
        };

        vulnerabilities.push(vulnerability);
      }
    }

    return vulnerabilities;
  }

  private async runComplianceChecks(config: ScanConfig, vulnerabilities: Vulnerability[]): Promise<any> {
    if (!config.compliance) return null;

    const results = [];
    let totalChecks = 0;
    let passedChecks = 0;

    for (const framework of config.compliance.frameworks) {
      const rules = Array.from(this.complianceRules.values())
        .filter(rule => rule.framework === framework);

      for (const rule of rules) {
        totalChecks++;
        try {
          const result = await rule.check(config.scope.targets, { vulnerabilities });
          if (result.passed) passedChecks++;

          results.push({
            requirement: rule.requirement,
            status: result.passed ? 'pass' : 'fail',
            evidence: result.evidence || result.message
          });
        } catch (error) {
          results.push({
            requirement: rule.requirement,
            status: 'not_applicable',
            evidence: `Check failed: ${error.message}`
          });
        }
      }
    }

    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    return {
      framework: config.compliance.frameworks.join(', '),
      score,
      passed: passedChecks,
      failed: totalChecks - passedChecks,
      details: results
    };
  }

  private async scheduleScan(config: ScanConfig): Promise<void> {
    if (!config.schedule?.enabled) return;

    // Calculate next execution time based on frequency
    let nextExecution: Date;
    const now = new Date();

    switch (config.schedule.frequency) {
      case 'daily':
        nextExecution = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextExecution = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextExecution = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    // Schedule the scan
    const timeout = setTimeout(async () => {
      try {
        await this.executeScan(config.scanId);
        // Reschedule if still active
        if (this.scanConfigs.get(config.scanId)?.isActive) {
          await this.scheduleScan(config);
        }
      } catch (error) {
        await this.auditLogger.logSecurityEvent({
          eventType: 'SCHEDULED_SCAN_FAILED',
          scanId: config.scanId,
          error: error.message
        });
      }
    }, nextExecution.getTime() - now.getTime());

    this.activeScanJobs.set(`schedule-${config.scanId}`, timeout);
  }

  private async sendScanNotifications(config: ScanConfig, result: ScanResult): Promise<void> {
    if (!config.notifications) return;

    const shouldNotify = config.notifications.onComplete || 
      (config.notifications.onHighSeverity && 
       (result.summary.vulnerabilities.high > 0 || result.summary.vulnerabilities.critical > 0));

    if (!shouldNotify) return;

    // Mock notification implementation
    await this.auditLogger.logSecurityEvent({
      eventType: 'SCAN_NOTIFICATION_SENT',
      scanId: config.scanId,
      resultId: result.resultId,
      details: {
        channels: config.notifications.channels,
        vulnerabilities: result.summary.vulnerabilities
      }
    });
  }

  private async handleCriticalVulnerabilities(config: ScanConfig, vulnerabilities: Vulnerability[]): Promise<void> {
    for (const vuln of vulnerabilities) {
      await this.threatDetector.reportSecurityEvent({
        type: 'critical_vulnerability',
        severity: 'critical',
        context: { scanId: config.scanId },
        vulnerability: vuln
      });
    }
  }

  private async handleMonitoringAlert(monitoringId: string, vulnerabilities: Vulnerability[], options: any): Promise<void> {
    if (options.autoRemediate) {
      // Implement auto-remediation logic
      for (const vuln of vulnerabilities) {
        if (vuln.remediation.effort === 'trivial') {
          // Auto-remediate trivial vulnerabilities
          await this.updateVulnerability(vuln.vulnerabilityId, { status: 'in_progress' }, 'system');
        }
      }
    }

    await this.auditLogger.logSecurityEvent({
      eventType: 'MONITORING_ALERT',
      monitoringId,
      details: {
        vulnerabilities: vulnerabilities.length,
        severities: vulnerabilities.map(v => v.severity),
        autoRemediate: options.autoRemediate
      }
    });
  }

  private calculateRiskScore(vulnerabilities: Vulnerability[]): number {
    if (vulnerabilities.length === 0) return 0;

    const severityWeights = { info: 0, low: 1, medium: 3, high: 7, critical: 10 };
    const totalWeight = vulnerabilities.reduce((sum, v) => sum + severityWeights[v.severity], 0);
    
    return Math.min(100, Math.round(totalWeight / vulnerabilities.length * 10));
  }

  private calculateComplianceScore(scanResults: ScanResult[]): number {
    const complianceResults = scanResults
      .map(r => r.compliance)
      .filter(Boolean);

    if (complianceResults.length === 0) return 0;

    const totalScore = complianceResults.reduce((sum, c) => sum + c!.score, 0);
    return Math.round(totalScore / complianceResults.length);
  }

  private calculateOverallComplianceScore(): number {
    const allResults = Array.from(this.scanResults.values())
      .map(r => r.compliance)
      .filter(Boolean);

    return this.calculateComplianceScore(Array.from(this.scanResults.values()));
  }

  private calculateSecurityTrends(scanResults: ScanResult[], vulnerabilities: Vulnerability[]): any {
    // Mock implementation
    return {
      newVulnerabilities: vulnerabilities.filter(v => 
        v.discoveredAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      resolvedVulnerabilities: vulnerabilities.filter(v => v.status === 'resolved').length,
      riskTrend: 'stable' as const
    };
  }

  private calculateMetricsTrends(): any {
    // Mock implementation
    return {
      scanFrequency: [
        { period: '2024-01', count: 15 },
        { period: '2024-02', count: 18 },
        { period: '2024-03', count: 22 }
      ],
      vulnerabilityTrends: [
        { period: '2024-01', count: 45, severity: 'high' },
        { period: '2024-02', count: 38, severity: 'high' },
        { period: '2024-03', count: 31, severity: 'high' }
      ],
      riskTrends: [
        { period: '2024-01', score: 75 },
        { period: '2024-02', score: 68 },
        { period: '2024-03', score: 62 }
      ]
    };
  }

  private getTopVulnerabilities(): any[] {
    const vulnerabilities = Array.from(this.vulnerabilities.values());
    const typeCounts: Record<string, { count: number; severity: string }> = {};

    vulnerabilities.forEach(v => {
      if (!typeCounts[v.type]) {
        typeCounts[v.type] = { count: 0, severity: v.severity };
      }
      typeCounts[v.type].count++;
    });

    return Object.entries(typeCounts)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getComplianceStatus(): any[] {
    // Mock implementation
    return [
      {
        framework: 'OWASP_TOP10',
        score: 85,
        requirements: { total: 10, passed: 8, failed: 2 }
      },
      {
        framework: 'CIS',
        score: 78,
        requirements: { total: 20, passed: 16, failed: 4 }
      }
    ];
  }

  private generateSecurityRecommendations(vulnerabilities: Vulnerability[]): string[] {
    const recommendations: string[] = [];
    
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      recommendations.push(`Immediately address ${criticalVulns.length} critical vulnerabilities`);
    }

    const commonTypes = this.getTopVulnerabilities().slice(0, 3);
    commonTypes.forEach(type => {
      recommendations.push(`Implement security controls to prevent ${type.type} vulnerabilities`);
    });

    return recommendations;
  }

  private async generateReportArtifact(report: any, format: string): Promise<any> {
    const artifactPath = `/tmp/security-report-${report.reportId}.${format}`;
    
    // Mock artifact generation
    const artifact = {
      reportPath: artifactPath,
      format,
      size: 1024 * 1024 // 1MB mock size
    };

    return artifact;
  }
}

export { SecurityScanner };