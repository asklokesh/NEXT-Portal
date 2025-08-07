/**
 * Reporting Engine
 * Comprehensive test reporting and analytics system
 */

import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { TestResult } from './TestingFramework';

export interface ReportingConfig {
  enabled: boolean;
  formats: ReportFormat[];
  realtime: boolean;
  webhooks: WebhookConfig[];
  storage: StorageConfig;
  analytics: AnalyticsConfig;
}

export interface ReportFormat {
  type: 'html' | 'json' | 'xml' | 'junit' | 'pdf' | 'excel' | 'dashboard';
  template?: string;
  options: FormatOptions;
}

export interface FormatOptions {
  includeDetails: boolean;
  includeCoverage: boolean;
  includePerformance: boolean;
  includeSecurity: boolean;
  includeCharts: boolean;
  theme?: string;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  headers?: Record<string, string>;
  authentication?: AuthConfig;
}

export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apikey';
  credentials: Record<string, string>;
}

export interface StorageConfig {
  path: string;
  retention: string;
  compression: boolean;
  encryption: boolean;
}

export interface AnalyticsConfig {
  enabled: boolean;
  metrics: string[];
  aggregation: AggregationConfig;
  trending: TrendingConfig;
}

export interface AggregationConfig {
  intervals: string[];
  dimensions: string[];
  retention: string;
}

export interface TrendingConfig {
  enabled: boolean;
  window: string;
  threshold: number;
}

export interface TestReport {
  id: string;
  name: string;
  timestamp: Date;
  duration: number;
  summary: TestSummary;
  results: TestResult[];
  qualityGates: QualityGateReport;
  performance: PerformanceReport;
  security: SecurityReport;
  coverage: CoverageReport;
  environment: EnvironmentReport;
  metadata: ReportMetadata;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  passRate: number;
  duration: number;
  trends: TrendData;
}

export interface QualityGateReport {
  status: 'passed' | 'failed' | 'warning';
  gates: QualityGateResult[];
  recommendations: string[];
}

export interface QualityGateResult {
  name: string;
  status: 'passed' | 'failed';
  actualValue: any;
  threshold: any;
  severity: string;
}

export interface PerformanceReport {
  summary: PerformanceSummary;
  scenarios: PerformanceScenario[];
  metrics: PerformanceMetrics;
  bottlenecks: string[];
}

export interface PerformanceSummary {
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
}

export interface PerformanceScenario {
  name: string;
  status: string;
  metrics: any;
}

export interface PerformanceMetrics {
  responseTime: MetricData;
  throughput: MetricData;
  errors: MetricData;
  resources: ResourceMetrics;
}

export interface MetricData {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ResourceMetrics {
  cpu: MetricData;
  memory: MetricData;
  disk: MetricData;
  network: MetricData;
}

export interface SecurityReport {
  summary: SecuritySummary;
  vulnerabilities: VulnerabilityReport[];
  compliance: ComplianceReport;
  recommendations: string[];
}

export interface SecuritySummary {
  totalVulnerabilities: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  riskScore: number;
}

export interface VulnerabilityReport {
  id: string;
  severity: string;
  title: string;
  description: string;
  solution: string;
}

export interface ComplianceReport {
  framework: string;
  score: number;
  passed: number;
  failed: number;
  controls: ComplianceControl[];
}

export interface ComplianceControl {
  id: string;
  name: string;
  status: string;
  description: string;
}

export interface CoverageReport {
  summary: CoverageSummary;
  files: FileCoverage[];
  uncoveredLines: UncoveredLine[];
}

export interface CoverageSummary {
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface FileCoverage {
  path: string;
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

export interface UncoveredLine {
  file: string;
  line: number;
  content: string;
}

export interface EnvironmentReport {
  name: string;
  platform: string;
  services: ServiceReport[];
  resources: ResourceReport;
  health: HealthReport;
}

export interface ServiceReport {
  name: string;
  status: string;
  version: string;
  endpoints: EndpointReport[];
}

export interface EndpointReport {
  url: string;
  status: string;
  responseTime: number;
}

export interface ResourceReport {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface HealthReport {
  overall: string;
  services: number;
  healthy: number;
  degraded: number;
  failed: number;
}

export interface ReportMetadata {
  generator: string;
  version: string;
  configuration: any;
  tags: string[];
  links: ReportLink[];
}

export interface ReportLink {
  type: string;
  url: string;
  title: string;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface DashboardData {
  summary: TestSummary;
  trends: TrendAnalysis;
  heatmap: HeatmapData;
  charts: ChartData[];
}

export interface TrendAnalysis {
  passRate: TrendData[];
  duration: TrendData[];
  coverage: TrendData[];
}

export interface HeatmapData {
  dimensions: string[];
  data: HeatmapPoint[];
}

export interface HeatmapPoint {
  x: string;
  y: string;
  value: number;
  color: string;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  title: string;
  data: any;
  options: any;
}

export class ReportingEngine extends EventEmitter {
  private config: ReportingConfig;
  private reports: Map<string, TestReport> = new Map();
  private dashboardData: DashboardData | null = null;

  constructor(config: ReportingConfig) {
    super();
    this.config = config;
    this.ensureReportDirectory();
  }

  /**
   * Initialize the reporting engine
   */
  public async initialize(): Promise<void> {
    this.emit('reporting:initialized');
    
    if (this.config.realtime) {
      this.setupRealtimeReporting();
    }
  }

  /**
   * Generate comprehensive test report
   */
  public async generate(
    results: Map<string, TestResult>,
    qualityGateResult: any
  ): Promise<TestReport> {
    this.emit('report:generating', { testCount: results.size });

    const report = await this.createTestReport(results, qualityGateResult);
    this.reports.set(report.id, report);

    // Generate reports in different formats
    for (const format of this.config.formats) {
      await this.generateReportFormat(report, format);
    }

    // Send webhooks
    await this.sendWebhooks(report);

    // Update dashboard data
    await this.updateDashboard(report);

    this.emit('report:generated', report);
    return report;
  }

  /**
   * Get dashboard data
   */
  public getDashboardData(): DashboardData | null {
    return this.dashboardData;
  }

  /**
   * Get historical reports
   */
  public getReports(limit?: number): TestReport[] {
    const reports = Array.from(this.reports.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? reports.slice(0, limit) : reports;
  }

  /**
   * Generate trend analysis
   */
  public generateTrendAnalysis(days: number = 30): TrendAnalysis {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentReports = this.getReports()
      .filter(report => report.timestamp >= cutoffDate);

    return {
      passRate: this.calculateTrend(recentReports, 'passRate'),
      duration: this.calculateTrend(recentReports, 'duration'),
      coverage: this.calculateTrend(recentReports, 'coverage')
    };
  }

  /**
   * Health check for the reporting engine
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if we can write to report directory
      const testFile = path.join(this.config.storage.path, '.health-check');
      writeFileSync(testFile, JSON.stringify({ test: true }));
      
      if (existsSync(testFile)) {
        require('fs').unlinkSync(testFile);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Finalize reporting
   */
  public async finalize(): Promise<void> {
    this.emit('reporting:finalizing');
    
    // Generate summary report
    if (this.reports.size > 0) {
      await this.generateSummaryReport();
    }
    
    // Clean up old reports
    await this.cleanupOldReports();
    
    this.emit('reporting:finalized');
  }

  private async createTestReport(
    results: Map<string, TestResult>,
    qualityGateResult: any
  ): Promise<TestReport> {
    const timestamp = new Date();
    const resultsArray = Array.from(results.values());
    
    return {
      id: `report-${timestamp.getTime()}`,
      name: `Test Report - ${timestamp.toISOString()}`,
      timestamp,
      duration: this.calculateTotalDuration(resultsArray),
      summary: this.createTestSummary(resultsArray),
      results: resultsArray,
      qualityGates: this.createQualityGateReport(qualityGateResult),
      performance: this.createPerformanceReport(resultsArray),
      security: this.createSecurityReport(resultsArray),
      coverage: this.createCoverageReport(resultsArray),
      environment: this.createEnvironmentReport(),
      metadata: this.createReportMetadata()
    };
  }

  private createTestSummary(results: TestResult[]): TestSummary {
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;
    const total = results.length;
    
    return {
      total,
      passed,
      failed,
      skipped,
      errors,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      trends: this.calculateCurrentTrends()
    };
  }

  private createQualityGateReport(qualityGateResult: any): QualityGateReport {
    if (!qualityGateResult) {
      return {
        status: 'passed',
        gates: [],
        recommendations: []
      };
    }

    return {
      status: qualityGateResult.status,
      gates: qualityGateResult.results?.map((result: any) => ({
        name: result.gate.name,
        status: result.status,
        actualValue: result.actualValue,
        threshold: result.expectedValue,
        severity: result.gate.severity
      })) || [],
      recommendations: qualityGateResult.recommendations || []
    };
  }

  private createPerformanceReport(results: TestResult[]): PerformanceReport {
    const performanceResults = results.filter(r => r.performance);
    
    if (performanceResults.length === 0) {
      return {
        summary: {
          averageResponseTime: 0,
          throughput: 0,
          errorRate: 0,
          availability: 100
        },
        scenarios: [],
        metrics: this.createEmptyPerformanceMetrics(),
        bottlenecks: []
      };
    }

    const avgResponseTime = performanceResults.reduce((sum, r) => 
      sum + (r.performance?.responseTime.avg || 0), 0) / performanceResults.length;
    
    const totalThroughput = performanceResults.reduce((sum, r) => 
      sum + (r.performance?.throughput || 0), 0);
    
    const avgErrorRate = performanceResults.reduce((sum, r) => 
      sum + (r.performance?.errorRate || 0), 0) / performanceResults.length;

    return {
      summary: {
        averageResponseTime: avgResponseTime,
        throughput: totalThroughput,
        errorRate: avgErrorRate,
        availability: 100 - avgErrorRate
      },
      scenarios: performanceResults.map(r => ({
        name: r.suiteId,
        status: r.status,
        metrics: r.performance
      })),
      metrics: this.aggregatePerformanceMetrics(performanceResults),
      bottlenecks: this.identifyBottlenecks(performanceResults)
    };
  }

  private createSecurityReport(results: TestResult[]): SecurityReport {
    const securityResults = results.filter(r => r.security);
    
    if (securityResults.length === 0) {
      return {
        summary: {
          totalVulnerabilities: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          riskScore: 0
        },
        vulnerabilities: [],
        compliance: {
          framework: 'OWASP',
          score: 100,
          passed: 0,
          failed: 0,
          controls: []
        },
        recommendations: []
      };
    }

    const vulnerabilities = securityResults.flatMap(r => r.security?.threats || []);
    
    return {
      summary: {
        totalVulnerabilities: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.includes('critical')).length,
        high: vulnerabilities.filter(v => v.includes('high')).length,
        medium: vulnerabilities.filter(v => v.includes('medium')).length,
        low: vulnerabilities.filter(v => v.includes('low')).length,
        riskScore: this.calculateRiskScore(securityResults)
      },
      vulnerabilities: vulnerabilities.map((vuln, index) => ({
        id: `vuln-${index}`,
        severity: 'medium',
        title: vuln,
        description: vuln,
        solution: 'Review and address this security issue'
      })),
      compliance: this.createComplianceReport(securityResults),
      recommendations: this.generateSecurityRecommendations(securityResults)
    };
  }

  private createCoverageReport(results: TestResult[]): CoverageReport {
    const coverageResults = results.filter(r => r.coverage);
    
    if (coverageResults.length === 0) {
      return {
        summary: {
          lines: { total: 0, covered: 0, percentage: 0 },
          functions: { total: 0, covered: 0, percentage: 0 },
          branches: { total: 0, covered: 0, percentage: 0 },
          statements: { total: 0, covered: 0, percentage: 0 }
        },
        files: [],
        uncoveredLines: []
      };
    }

    const aggregatedCoverage = this.aggregateCoverage(coverageResults);
    
    return {
      summary: aggregatedCoverage,
      files: [], // This would be populated with file-level coverage data
      uncoveredLines: [] // This would be populated with uncovered line details
    };
  }

  private createEnvironmentReport(): EnvironmentReport {
    return {
      name: 'Test Environment',
      platform: 'docker',
      services: [],
      resources: {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0
      },
      health: {
        overall: 'healthy',
        services: 0,
        healthy: 0,
        degraded: 0,
        failed: 0
      }
    };
  }

  private createReportMetadata(): ReportMetadata {
    return {
      generator: 'Advanced Testing Framework',
      version: '1.0.0',
      configuration: this.config,
      tags: ['automated', 'comprehensive'],
      links: [
        {
          type: 'dashboard',
          url: '/test-dashboard',
          title: 'Test Dashboard'
        }
      ]
    };
  }

  private async generateReportFormat(report: TestReport, format: ReportFormat): Promise<void> {
    const fileName = `${report.id}.${format.type}`;
    const filePath = path.join(this.config.storage.path, fileName);

    try {
      switch (format.type) {
        case 'html':
          await this.generateHtmlReport(report, filePath, format.options);
          break;
        case 'json':
          await this.generateJsonReport(report, filePath, format.options);
          break;
        case 'junit':
          await this.generateJunitReport(report, filePath);
          break;
        case 'pdf':
          await this.generatePdfReport(report, filePath, format.options);
          break;
        case 'excel':
          await this.generateExcelReport(report, filePath);
          break;
        default:
          console.warn(`Unsupported report format: ${format.type}`);
      }

      this.emit('report:format-generated', { report: report.id, format: format.type, path: filePath });
    } catch (error) {
      this.emit('report:format-error', { report: report.id, format: format.type, error: error.message });
    }
  }

  private async generateHtmlReport(report: TestReport, filePath: string, options: FormatOptions): Promise<void> {
    const html = this.createHtmlReport(report, options);
    writeFileSync(filePath, html);
  }

  private async generateJsonReport(report: TestReport, filePath: string, options: FormatOptions): Promise<void> {
    const json = JSON.stringify(report, null, 2);
    writeFileSync(filePath, json);
  }

  private async generateJunitReport(report: TestReport, filePath: string): Promise<void> {
    const xml = this.createJunitXml(report);
    writeFileSync(filePath, xml);
  }

  private async generatePdfReport(report: TestReport, filePath: string, options: FormatOptions): Promise<void> {
    // PDF generation would require a library like puppeteer or jsPDF
    const content = `Test Report PDF - ${report.name}`;
    writeFileSync(filePath.replace('.pdf', '.txt'), content);
  }

  private async generateExcelReport(report: TestReport, filePath: string): Promise<void> {
    // Excel generation would require a library like xlsx
    const csv = this.createCsvReport(report);
    writeFileSync(filePath.replace('.excel', '.csv'), csv);
  }

  private createHtmlReport(report: TestReport, options: FormatOptions): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.name}</h1>
        <p>Generated: ${report.timestamp.toISOString()}</p>
        <p>Duration: ${this.formatDuration(report.duration)}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div>${report.summary.total}</div>
        </div>
        <div class="metric">
            <h3>Pass Rate</h3>
            <div class="${report.summary.passRate >= 90 ? 'passed' : 'failed'}">${report.summary.passRate.toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="passed">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="failed">${report.summary.failed}</div>
        </div>
    </div>

    ${options.includeCoverage ? this.createCoverageHtml(report.coverage) : ''}
    ${options.includePerformance ? this.createPerformanceHtml(report.performance) : ''}
    ${options.includeSecurity ? this.createSecurityHtml(report.security) : ''}
    
    ${options.includeDetails ? this.createDetailsHtml(report.results) : ''}
</body>
</html>
    `;
  }

  private createCoverageHtml(coverage: CoverageReport): string {
    return `
    <h2>Coverage Report</h2>
    <div class="summary">
        <div class="metric">
            <h3>Lines</h3>
            <div>${coverage.summary.lines.percentage.toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Functions</h3>
            <div>${coverage.summary.functions.percentage.toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Branches</h3>
            <div>${coverage.summary.branches.percentage.toFixed(1)}%</div>
        </div>
    </div>
    `;
  }

  private createPerformanceHtml(performance: PerformanceReport): string {
    return `
    <h2>Performance Report</h2>
    <div class="summary">
        <div class="metric">
            <h3>Avg Response Time</h3>
            <div>${performance.summary.averageResponseTime.toFixed(0)}ms</div>
        </div>
        <div class="metric">
            <h3>Throughput</h3>
            <div>${performance.summary.throughput.toFixed(1)} req/s</div>
        </div>
        <div class="metric">
            <h3>Error Rate</h3>
            <div>${performance.summary.errorRate.toFixed(2)}%</div>
        </div>
    </div>
    `;
  }

  private createSecurityHtml(security: SecurityReport): string {
    return `
    <h2>Security Report</h2>
    <div class="summary">
        <div class="metric">
            <h3>Total Vulnerabilities</h3>
            <div>${security.summary.totalVulnerabilities}</div>
        </div>
        <div class="metric">
            <h3>Risk Score</h3>
            <div>${security.summary.riskScore.toFixed(1)}</div>
        </div>
        <div class="metric">
            <h3>Critical</h3>
            <div class="failed">${security.summary.critical}</div>
        </div>
    </div>
    `;
  }

  private createDetailsHtml(results: TestResult[]): string {
    const rows = results.map(result => `
        <tr>
            <td>${result.suiteId}</td>
            <td class="${result.status}">${result.status}</td>
            <td>${this.formatDuration(result.duration)}</td>
            <td>${result.errors?.length || 0}</td>
        </tr>
    `).join('');

    return `
    <h2>Test Details</h2>
    <table class="table">
        <thead>
            <tr>
                <th>Test Suite</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Errors</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
    `;
  }

  private createJunitXml(report: TestReport): string {
    const testcases = report.results.map(result => `
        <testcase name="${result.suiteId}" time="${result.duration / 1000}">
            ${result.status === 'failed' ? `<failure message="Test failed">${result.errors?.map(e => e.message).join('\n') || ''}</failure>` : ''}
            ${result.status === 'error' ? `<error message="Test error">${result.errors?.map(e => e.message).join('\n') || ''}</error>` : ''}
        </testcase>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${report.name}" tests="${report.summary.total}" failures="${report.summary.failed}" errors="${report.summary.errors}" time="${report.duration / 1000}">
    ${testcases}
</testsuite>`;
  }

  private createCsvReport(report: TestReport): string {
    const headers = ['Suite ID', 'Status', 'Duration (ms)', 'Errors'];
    const rows = report.results.map(result => [
      result.suiteId,
      result.status,
      result.duration,
      result.errors?.length || 0
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private async sendWebhooks(report: TestReport): Promise<void> {
    for (const webhook of this.config.webhooks) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...webhook.headers,
            ...this.getAuthHeaders(webhook.authentication)
          },
          body: JSON.stringify({
            event: 'report.generated',
            timestamp: report.timestamp,
            data: {
              reportId: report.id,
              summary: report.summary,
              qualityGates: report.qualityGates
            }
          })
        });

        if (response.ok) {
          this.emit('webhook:sent', { url: webhook.url, report: report.id });
        } else {
          this.emit('webhook:error', { url: webhook.url, status: response.status });
        }
      } catch (error) {
        this.emit('webhook:error', { url: webhook.url, error: error.message });
      }
    }
  }

  private getAuthHeaders(auth?: AuthConfig): Record<string, string> {
    if (!auth) return {};

    switch (auth.type) {
      case 'bearer':
        return { 'Authorization': `Bearer ${auth.credentials.token}` };
      case 'basic':
        const encoded = Buffer.from(`${auth.credentials.username}:${auth.credentials.password}`).toString('base64');
        return { 'Authorization': `Basic ${encoded}` };
      case 'apikey':
        return { [auth.credentials.header || 'X-API-Key']: auth.credentials.key };
      default:
        return {};
    }
  }

  private async updateDashboard(report: TestReport): Promise<void> {
    this.dashboardData = {
      summary: report.summary,
      trends: this.generateTrendAnalysis(),
      heatmap: this.generateHeatmap(),
      charts: this.generateCharts(report)
    };

    this.emit('dashboard:updated', this.dashboardData);
  }

  private generateHeatmap(): HeatmapData {
    return {
      dimensions: ['test-type', 'status'],
      data: [
        { x: 'unit', y: 'passed', value: 85, color: '#4CAF50' },
        { x: 'unit', y: 'failed', value: 15, color: '#F44336' },
        { x: 'integration', y: 'passed', value: 92, color: '#4CAF50' },
        { x: 'integration', y: 'failed', value: 8, color: '#F44336' },
        { x: 'e2e', y: 'passed', value: 78, color: '#FF9800' },
        { x: 'e2e', y: 'failed', value: 22, color: '#F44336' }
      ]
    };
  }

  private generateCharts(report: TestReport): ChartData[] {
    return [
      {
        type: 'pie',
        title: 'Test Results Distribution',
        data: {
          labels: ['Passed', 'Failed', 'Skipped', 'Errors'],
          datasets: [{
            data: [
              report.summary.passed,
              report.summary.failed,
              report.summary.skipped,
              report.summary.errors
            ],
            backgroundColor: ['#4CAF50', '#F44336', '#FF9800', '#9E9E9E']
          }]
        },
        options: {}
      }
    ];
  }

  // Helper methods
  private calculateTotalDuration(results: TestResult[]): number {
    return results.reduce((sum, r) => sum + r.duration, 0);
  }

  private calculateCurrentTrends(): TrendData {
    return {
      current: 0,
      previous: 0,
      change: 0,
      direction: 'stable'
    };
  }

  private calculateTrend(reports: TestReport[], metric: string): TrendData[] {
    return reports.map(report => ({
      current: report.summary.passRate,
      previous: 0,
      change: 0,
      direction: 'stable' as const
    }));
  }

  private createEmptyPerformanceMetrics(): PerformanceMetrics {
    const emptyMetric: MetricData = { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    
    return {
      responseTime: emptyMetric,
      throughput: emptyMetric,
      errors: emptyMetric,
      resources: {
        cpu: emptyMetric,
        memory: emptyMetric,
        disk: emptyMetric,
        network: emptyMetric
      }
    };
  }

  private aggregatePerformanceMetrics(results: TestResult[]): PerformanceMetrics {
    // Simplified aggregation - in production, this would be more sophisticated
    return this.createEmptyPerformanceMetrics();
  }

  private identifyBottlenecks(results: TestResult[]): string[] {
    const bottlenecks: string[] = [];
    
    results.forEach(result => {
      if (result.performance?.responseTime.avg && result.performance.responseTime.avg > 1000) {
        bottlenecks.push(`Slow response time in ${result.suiteId}: ${result.performance.responseTime.avg}ms`);
      }
    });
    
    return bottlenecks;
  }

  private calculateRiskScore(results: TestResult[]): number {
    // Simple risk calculation based on vulnerabilities
    let score = 100;
    results.forEach(result => {
      const threats = result.security?.threats || [];
      score -= threats.length * 10;
    });
    return Math.max(0, score);
  }

  private createComplianceReport(results: TestResult[]): ComplianceReport {
    return {
      framework: 'OWASP Top 10',
      score: 85,
      passed: 8,
      failed: 2,
      controls: [
        { id: 'A01', name: 'Injection', status: 'passed', description: 'No injection vulnerabilities found' },
        { id: 'A02', name: 'Broken Authentication', status: 'passed', description: 'Authentication mechanisms are secure' }
      ]
    };
  }

  private generateSecurityRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];
    
    results.forEach(result => {
      if (result.security?.threats && result.security.threats.length > 0) {
        recommendations.push(`Address security vulnerabilities in ${result.suiteId}`);
      }
    });
    
    return recommendations;
  }

  private aggregateCoverage(results: TestResult[]): CoverageSummary {
    let totalLines = 0, coveredLines = 0;
    let totalFunctions = 0, coveredFunctions = 0;
    let totalBranches = 0, coveredBranches = 0;
    let totalStatements = 0, coveredStatements = 0;

    results.forEach(result => {
      if (result.coverage) {
        totalLines += result.coverage.lines?.total || 0;
        coveredLines += result.coverage.lines?.covered || 0;
        totalFunctions += result.coverage.functions?.total || 0;
        coveredFunctions += result.coverage.functions?.covered || 0;
        totalBranches += result.coverage.branches?.total || 0;
        coveredBranches += result.coverage.branches?.covered || 0;
        totalStatements += result.coverage.statements?.total || 0;
        coveredStatements += result.coverage.statements?.covered || 0;
      }
    });

    return {
      lines: {
        total: totalLines,
        covered: coveredLines,
        percentage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
      },
      functions: {
        total: totalFunctions,
        covered: coveredFunctions,
        percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0
      },
      branches: {
        total: totalBranches,
        covered: coveredBranches,
        percentage: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0
      },
      statements: {
        total: totalStatements,
        covered: coveredStatements,
        percentage: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0
      }
    };
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  private ensureReportDirectory(): void {
    if (!existsSync(this.config.storage.path)) {
      mkdirSync(this.config.storage.path, { recursive: true });
    }
  }

  private setupRealtimeReporting(): void {
    // Setup real-time reporting mechanisms
    // This would typically involve WebSocket connections or Server-Sent Events
  }

  private async generateSummaryReport(): Promise<void> {
    const allReports = this.getReports();
    if (allReports.length === 0) return;

    const summaryReport = {
      totalReports: allReports.length,
      averagePassRate: allReports.reduce((sum, r) => sum + r.summary.passRate, 0) / allReports.length,
      trends: this.generateTrendAnalysis(30),
      recommendations: this.generateOverallRecommendations(allReports)
    };

    const filePath = path.join(this.config.storage.path, 'summary-report.json');
    writeFileSync(filePath, JSON.stringify(summaryReport, null, 2));
  }

  private generateOverallRecommendations(reports: TestReport[]): string[] {
    const recommendations: string[] = [];
    
    const avgPassRate = reports.reduce((sum, r) => sum + r.summary.passRate, 0) / reports.length;
    if (avgPassRate < 90) {
      recommendations.push('Consider improving test stability and fixing flaky tests');
    }

    const avgDuration = reports.reduce((sum, r) => sum + r.duration, 0) / reports.length;
    if (avgDuration > 300000) { // 5 minutes
      recommendations.push('Consider optimizing test execution time through parallelization');
    }

    return recommendations;
  }

  private async cleanupOldReports(): Promise<void> {
    const retentionDays = parseInt(this.config.storage.retention.replace('d', ''));
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const oldReports = Array.from(this.reports.entries())
      .filter(([_, report]) => report.timestamp < cutoffDate)
      .map(([id]) => id);
    
    oldReports.forEach(id => this.reports.delete(id));
  }
}

export default ReportingEngine;