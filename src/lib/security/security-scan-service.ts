import Redis from 'ioredis';
import { RealtimeEventService } from '@/lib/events/realtime-event-service';

export interface SecurityScanResult {
  scanId: string;
  repositoryId?: string;
  packageName?: string;
  version?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  findings: SecurityFinding[];
  summary: {
    totalVulnerabilities: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  scanType: 'dependency' | 'code' | 'container' | 'license' | 'comprehensive';
  startedAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

export interface SecurityFinding {
  id: string;
  type: 'vulnerability' | 'license' | 'malware' | 'secret' | 'code-quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  package?: string;
  version?: string;
  cve?: string;
  cwe?: string[];
  cvss?: {
    score: number;
    vector: string;
  };
  affectedFiles?: string[];
  recommendation: string;
  references: string[];
  fixAvailable: boolean;
  fixVersion?: string;
  patchAvailable: boolean;
  detectedAt: string;
  source: string;
}

export interface ScanRequest {
  type: string;
  source: string;
  repository?: {
    id: string | number;
    name: string;
    fullName: string;
    url: string;
  };
  package?: {
    name: string;
    version: string;
    tarball?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  commitId?: string;
  changedFiles?: string[];
  timestamp: string;
}

export class SecurityScanService {
  private redis: Redis;
  private realtimeEvents: RealtimeEventService;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableAutoPipelining: true,
      db: 2 // Use different DB for security scans
    });
    
    this.realtimeEvents = RealtimeEventService.getInstance();
    this.initializeWorker();
  }

  private initializeWorker() {
    // Process security scan queue
    setInterval(async () => {
      try {
        const scanRequest = await this.redis.brpop('security_scan_queue', 1);
        if (scanRequest) {
          const [, requestData] = scanRequest;
          const request: ScanRequest = JSON.parse(requestData);
          await this.processScanRequest(request);
        }
      } catch (error) {
        console.error('Error processing security scan queue:', error);
      }
    }, 1000);
  }

  private async processScanRequest(request: ScanRequest): Promise<void> {
    const scanId = this.generateScanId();
    
    try {
      console.log(`Starting security scan ${scanId} for ${request.type}`);
      
      // Create initial scan result
      const scanResult: SecurityScanResult = {
        scanId,
        repositoryId: request.repository?.id.toString(),
        packageName: request.package?.name,
        version: request.package?.version,
        status: 'running',
        severity: 'low',
        findings: [],
        summary: {
          totalVulnerabilities: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        },
        scanType: this.determineScanType(request),
        startedAt: new Date().toISOString(),
        metadata: {
          source: request.source,
          type: request.type,
          commitId: request.commitId,
          changedFiles: request.changedFiles
        }
      };

      // Store scan result
      await this.storeScanResult(scanResult);

      // Broadcast scan started
      await this.realtimeEvents.broadcastSecurityEvent('scan.started', {
        scanId,
        type: request.type,
        source: request.source,
        repository: request.repository?.fullName,
        package: request.package?.name,
        version: request.package?.version
      });

      // Perform the actual scan
      const findings = await this.performSecurityScan(request, scanResult);
      
      // Update scan result with findings
      scanResult.findings = findings;
      scanResult.summary = this.calculateSummary(findings);
      scanResult.severity = this.calculateOverallSeverity(findings);
      scanResult.status = 'completed';
      scanResult.completedAt = new Date().toISOString();

      // Store updated result
      await this.storeScanResult(scanResult);

      // Broadcast scan completed
      await this.realtimeEvents.broadcastSecurityEvent('scan.completed', {
        scanId,
        type: request.type,
        source: request.source,
        repository: request.repository?.fullName,
        package: request.package?.name,
        version: request.package?.version,
        severity: scanResult.severity,
        summary: scanResult.summary,
        findings: findings.slice(0, 10) // Send only top 10 findings in real-time
      });

      console.log(`Security scan ${scanId} completed with ${findings.length} findings`);

    } catch (error) {
      console.error(`Security scan ${scanId} failed:`, error);
      
      // Update scan result with error
      const failedResult: Partial<SecurityScanResult> = {
        scanId,
        status: 'failed',
        completedAt: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      await this.storeScanResult(failedResult as SecurityScanResult);

      // Broadcast scan failed
      await this.realtimeEvents.broadcastSecurityEvent('scan.failed', {
        scanId,
        type: request.type,
        source: request.source,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async performSecurityScan(request: ScanRequest, scanResult: SecurityScanResult): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    switch (request.type) {
      case 'dependency_update':
      case 'package_published':
        findings.push(...await this.scanDependencies(request));
        break;
      
      case 'new_release':
        findings.push(...await this.scanRelease(request));
        break;
      
      case 'repository_update':
        findings.push(...await this.scanRepository(request));
        break;
      
      case 'security_advisory':
        findings.push(...await this.processSecurityAdvisory(request));
        break;
      
      default:
        console.warn(`Unknown scan type: ${request.type}`);
    }

    return findings;
  }

  private async scanDependencies(request: ScanRequest): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    if (request.package) {
      // Scan package dependencies
      const dependencies = {
        ...request.package.dependencies,
        ...request.package.devDependencies,
        ...request.package.peerDependencies
      };

      for (const [depName, depVersion] of Object.entries(dependencies || {})) {
        // Simulate vulnerability scanning
        const vulnerabilities = await this.checkPackageVulnerabilities(depName, depVersion);
        findings.push(...vulnerabilities);
      }
    }

    if (request.changedFiles) {
      // Scan changed dependency files
      const dependencyFiles = request.changedFiles.filter(file => 
        file.includes('package.json') || 
        file.includes('yarn.lock') || 
        file.includes('package-lock.json')
      );

      for (const file of dependencyFiles) {
        const fileFindings = await this.scanDependencyFile(file, request);
        findings.push(...fileFindings);
      }
    }

    return findings;
  }

  private async checkPackageVulnerabilities(packageName: string, version: string): Promise<SecurityFinding[]> {
    // This is a simplified implementation
    // In production, you would integrate with services like:
    // - npm audit
    // - Snyk
    // - GitHub Security Advisories
    // - OWASP Dependency Check
    // - Sonatype OSS Index

    const findings: SecurityFinding[] = [];

    // Simulate some common vulnerability patterns
    const vulnerablePatterns = [
      { pattern: /^lodash@[0-3]\./, severity: 'high' as const, cve: 'CVE-2021-23337' },
      { pattern: /^axios@0\.[0-9]\./, severity: 'medium' as const, cve: 'CVE-2020-28168' },
      { pattern: /^moment@[0-1]\./, severity: 'low' as const, cve: 'CVE-2017-18214' }
    ];

    for (const { pattern, severity, cve } of vulnerablePatterns) {
      if (pattern.test(`${packageName}@${version}`)) {
        findings.push({
          id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'vulnerability',
          severity,
          title: `Vulnerability in ${packageName}`,
          description: `Package ${packageName}@${version} has a known vulnerability`,
          package: packageName,
          version,
          cve,
          recommendation: `Update ${packageName} to the latest secure version`,
          references: [
            `https://nvd.nist.gov/vuln/detail/${cve}`,
            `https://npmjs.com/package/${packageName}`
          ],
          fixAvailable: true,
          fixVersion: this.getFixVersion(packageName, version),
          patchAvailable: true,
          detectedAt: new Date().toISOString(),
          source: 'security-scan-service'
        });
      }
    }

    return findings;
  }

  private async scanDependencyFile(file: string, request: ScanRequest): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Simulate file-based security scanning
    if (file.includes('package.json')) {
      // Check for suspicious scripts or dependencies
      findings.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'code-quality',
        severity: 'low',
        title: 'Package.json security review',
        description: 'Package.json file should be reviewed for security best practices',
        affectedFiles: [file],
        recommendation: 'Review package.json for suspicious scripts or dependencies',
        references: [
          'https://docs.npmjs.com/about-audit',
          'https://blog.npmjs.org/post/141702881055/package-install-scripts-vulnerability'
        ],
        fixAvailable: false,
        patchAvailable: false,
        detectedAt: new Date().toISOString(),
        source: 'security-scan-service'
      });
    }

    return findings;
  }

  private async scanRelease(request: ScanRequest): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Comprehensive scan for new releases
    if (request.package) {
      findings.push(...await this.scanDependencies(request));
    }

    if (request.repository) {
      findings.push(...await this.scanRepository(request));
    }

    return findings;
  }

  private async scanRepository(request: ScanRequest): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Simulate repository scanning
    // In production, integrate with tools like:
    // - CodeQL
    // - SonarQube
    // - Bandit (Python)
    // - ESLint security rules
    // - Semgrep

    findings.push({
      id: `repo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'code-quality',
      severity: 'medium',
      title: 'Repository security baseline check',
      description: 'Repository has been scanned for common security issues',
      recommendation: 'Review code for security best practices and enable security scanning tools',
      references: [
        'https://docs.github.com/en/code-security',
        'https://owasp.org/www-project-top-ten/'
      ],
      fixAvailable: false,
      patchAvailable: false,
      detectedAt: new Date().toISOString(),
      source: 'security-scan-service'
    });

    return findings;
  }

  private async processSecurityAdvisory(request: ScanRequest): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Process security advisories and create findings
    // This would typically parse CVE data or GitHub Security Advisories

    findings.push({
      id: `advisory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'vulnerability',
      severity: 'high',
      title: 'Security Advisory Processing',
      description: 'Processing security advisory for repository',
      recommendation: 'Review and apply security patches as recommended in the advisory',
      references: [],
      fixAvailable: true,
      patchAvailable: true,
      detectedAt: new Date().toISOString(),
      source: 'security-advisory'
    });

    return findings;
  }

  private determineScanType(request: ScanRequest): SecurityScanResult['scanType'] {
    if (request.type.includes('dependency') || request.type.includes('package')) {
      return 'dependency';
    }
    if (request.type.includes('repository')) {
      return 'code';
    }
    if (request.type.includes('release')) {
      return 'comprehensive';
    }
    return 'code';
  }

  private calculateSummary(findings: SecurityFinding[]): SecurityScanResult['summary'] {
    const summary = {
      totalVulnerabilities: findings.length,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0
    };

    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          summary.criticalCount++;
          break;
        case 'high':
          summary.highCount++;
          break;
        case 'medium':
          summary.mediumCount++;
          break;
        case 'low':
          summary.lowCount++;
          break;
      }
    });

    return summary;
  }

  private calculateOverallSeverity(findings: SecurityFinding[]): SecurityScanResult['severity'] {
    if (findings.some(f => f.severity === 'critical')) return 'critical';
    if (findings.some(f => f.severity === 'high')) return 'high';
    if (findings.some(f => f.severity === 'medium')) return 'medium';
    return 'low';
  }

  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFixVersion(packageName: string, currentVersion: string): string {
    // Simplified fix version calculation
    // In production, this would query vulnerability databases
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2] || '0', 10);
    
    return `${major}.${minor}.${patch + 1}`;
  }

  private async storeScanResult(scanResult: SecurityScanResult): Promise<void> {
    try {
      const key = `security_scan:${scanResult.scanId}`;
      await this.redis.setex(key, 86400 * 7, JSON.stringify(scanResult)); // 7 days TTL
      
      // Also store in a sortable list for queries
      await this.redis.zadd(
        'security_scans:by_time',
        Date.now(),
        scanResult.scanId
      );
      
      // Index by repository/package for quick lookups
      if (scanResult.repositoryId) {
        await this.redis.zadd(
          `security_scans:repo:${scanResult.repositoryId}`,
          Date.now(),
          scanResult.scanId
        );
      }
      
      if (scanResult.packageName) {
        await this.redis.zadd(
          `security_scans:package:${scanResult.packageName}`,
          Date.now(),
          scanResult.scanId
        );
      }
    } catch (error) {
      console.error('Error storing scan result:', error);
    }
  }

  // Public API methods
  public async getScanResult(scanId: string): Promise<SecurityScanResult | null> {
    try {
      const result = await this.redis.get(`security_scan:${scanId}`);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Error getting scan result:', error);
      return null;
    }
  }

  public async getScanHistory(
    repositoryId?: string,
    packageName?: string,
    limit: number = 10
  ): Promise<SecurityScanResult[]> {
    try {
      let key = 'security_scans:by_time';
      if (repositoryId) {
        key = `security_scans:repo:${repositoryId}`;
      } else if (packageName) {
        key = `security_scans:package:${packageName}`;
      }

      const scanIds = await this.redis.zrevrange(key, 0, limit - 1);
      const results = await Promise.all(
        scanIds.map(async (scanId) => {
          const result = await this.redis.get(`security_scan:${scanId}`);
          return result ? JSON.parse(result) : null;
        })
      );

      return results.filter(result => result !== null);
    } catch (error) {
      console.error('Error getting scan history:', error);
      return [];
    }
  }

  public async triggerScan(request: Partial<ScanRequest>): Promise<string> {
    const scanRequest: ScanRequest = {
      type: request.type || 'manual',
      source: request.source || 'api',
      repository: request.repository,
      package: request.package,
      commitId: request.commitId,
      changedFiles: request.changedFiles,
      timestamp: new Date().toISOString()
    };

    await this.redis.lpush('security_scan_queue', JSON.stringify(scanRequest));
    return this.generateScanId();
  }

  public async getSecurityMetrics(): Promise<{
    totalScans: number;
    recentScans: number;
    averageFindingsPerScan: number;
    severityDistribution: Record<string, number>;
  }> {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      // Get recent scan IDs
      const recentScanIds = await this.redis.zrangebyscore(
        'security_scans:by_time',
        oneDayAgo,
        now
      );

      // Get total scans
      const totalScans = await this.redis.zcard('security_scans:by_time');

      // Calculate metrics from recent scans
      const recentScans = recentScanIds.length;
      let totalFindings = 0;
      const severityDistribution = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };

      for (const scanId of recentScanIds.slice(0, 100)) { // Limit to avoid performance issues
        const scanResult = await this.getScanResult(scanId);
        if (scanResult) {
          totalFindings += scanResult.summary.totalVulnerabilities;
          severityDistribution.critical += scanResult.summary.criticalCount;
          severityDistribution.high += scanResult.summary.highCount;
          severityDistribution.medium += scanResult.summary.mediumCount;
          severityDistribution.low += scanResult.summary.lowCount;
        }
      }

      return {
        totalScans,
        recentScans,
        averageFindingsPerScan: recentScans > 0 ? totalFindings / recentScans : 0,
        severityDistribution
      };
    } catch (error) {
      console.error('Error getting security metrics:', error);
      return {
        totalScans: 0,
        recentScans: 0,
        averageFindingsPerScan: 0,
        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 }
      };
    }
  }
}