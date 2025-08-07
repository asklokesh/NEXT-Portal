import { ContractTestResult, ContractMetrics, CompatibilityResult, PactContract } from '../types';
import { CompatibilityMatrix, MatrixSummary } from '../versioning/compatibility-matrix';
import { Logger } from 'winston';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ReportOptions {
  outputDir: string;
  format: 'html' | 'json' | 'junit' | 'markdown';
  includeDetails?: boolean;
  includeCharts?: boolean;
  includeCompatibilityMatrix?: boolean;
  includeTrends?: boolean;
  customTemplate?: string;
  theme?: 'light' | 'dark';
}

export interface ContractReport {
  id: string;
  title: string;
  generatedAt: Date;
  summary: ReportSummary;
  testResults: ContractTestResult[];
  compatibilityResults?: CompatibilityResult[];
  metrics: ContractMetrics;
  matrixSummary?: MatrixSummary;
  trends?: TrendData[];
  charts?: ChartData[];
  filePath?: string;
}

export interface ReportSummary {
  totalContracts: number;
  totalInteractions: number;
  passedTests: number;
  failedTests: number;
  overallPassRate: number;
  averageTestDuration: number;
  criticalIssues: number;
  warnings: number;
}

export interface TrendData {
  date: string;
  passRate: number;
  testCount: number;
  averageDuration: number;
  coveragePercent: number;
}

export interface ChartData {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: any;
  options?: any;
}

export class ContractReporter {
  private logger: Logger;
  private compatibilityMatrix: CompatibilityMatrix;

  constructor(logger: Logger) {
    this.logger = logger;
    this.compatibilityMatrix = new CompatibilityMatrix(logger);
  }

  /**
   * Generate comprehensive contract test report
   */
  async generateReport(
    testResults: ContractTestResult[],
    options: ReportOptions,
    compatibilityResults?: CompatibilityResult[],
    historicalData?: TrendData[]
  ): Promise<ContractReport> {
    this.logger.info('Generating contract test report', {
      testResultCount: testResults.length,
      format: options.format,
      outputDir: options.outputDir
    });

    // Ensure output directory exists
    mkdirSync(options.outputDir, { recursive: true });

    // Calculate summary metrics
    const summary = this.calculateSummary(testResults, compatibilityResults);
    const metrics = this.calculateMetrics(testResults, historicalData);

    // Get compatibility matrix if requested
    let matrixSummary: MatrixSummary | undefined;
    if (options.includeCompatibilityMatrix) {
      matrixSummary = this.compatibilityMatrix.generateCompatibilityReport();
    }

    // Generate charts if requested
    let charts: ChartData[] | undefined;
    if (options.includeCharts) {
      charts = this.generateCharts(testResults, historicalData, summary);
    }

    // Create report object
    const report: ContractReport = {
      id: this.generateReportId(),
      title: `Contract Test Report - ${new Date().toISOString().split('T')[0]}`,
      generatedAt: new Date(),
      summary,
      testResults,
      compatibilityResults,
      metrics,
      matrixSummary,
      trends: historicalData,
      charts
    };

    // Generate report file
    const filePath = await this.renderReport(report, options);
    report.filePath = filePath;

    this.logger.info('Contract test report generated', {
      filePath,
      format: options.format,
      testCount: testResults.length,
      passRate: summary.overallPassRate
    });

    return report;
  }

  /**
   * Generate real-time dashboard data
   */
  generateDashboardData(
    testResults: ContractTestResult[],
    compatibilityResults?: CompatibilityResult[]
  ): {
    summary: ReportSummary;
    recentTests: ContractTestResult[];
    alerts: { level: 'error' | 'warning' | 'info'; message: string; timestamp: Date }[];
    metrics: ContractMetrics;
  } {
    const summary = this.calculateSummary(testResults, compatibilityResults);
    const recentTests = testResults
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
      .slice(0, 10);

    const alerts = this.generateAlerts(testResults, compatibilityResults);
    const metrics = this.calculateMetrics(testResults);

    return {
      summary,
      recentTests,
      alerts,
      metrics
    };
  }

  /**
   * Generate test coverage report
   */
  generateCoverageReport(
    contracts: PactContract[],
    testResults: ContractTestResult[]
  ): {
    overallCoverage: number;
    contractCoverage: { contract: string; coverage: number; details: any }[];
    uncoveredInteractions: { contract: string; interaction: string }[];
  } {
    const contractCoverage: any[] = [];
    const uncoveredInteractions: any[] = [];
    let totalInteractions = 0;
    let coveredInteractions = 0;

    contracts.forEach(contract => {
      const contractId = `${contract.consumer.name}-${contract.provider.name}`;
      const contractTests = testResults.filter(r => r.contractId === contractId);
      
      if (contractTests.length === 0) {
        // No tests for this contract
        contract.interactions.forEach(interaction => {
          uncoveredInteractions.push({
            contract: contractId,
            interaction: interaction.description
          });
        });
        
        contractCoverage.push({
          contract: contractId,
          coverage: 0,
          details: {
            totalInteractions: contract.interactions.length,
            coveredInteractions: 0,
            uncoveredInteractions: contract.interactions.length
          }
        });
        
        totalInteractions += contract.interactions.length;
        return;
      }

      // Calculate coverage for this contract
      const latestTest = contractTests[contractTests.length - 1];
      const testedInteractions = latestTest.interactions.length;
      const coverage = contract.interactions.length > 0 
        ? (testedInteractions / contract.interactions.length) * 100 
        : 0;

      contractCoverage.push({
        contract: contractId,
        coverage,
        details: {
          totalInteractions: contract.interactions.length,
          coveredInteractions: testedInteractions,
          uncoveredInteractions: contract.interactions.length - testedInteractions
        }
      });

      totalInteractions += contract.interactions.length;
      coveredInteractions += testedInteractions;

      // Find uncovered interactions
      const testedDescriptions = new Set(latestTest.interactions.map(i => i.description));
      contract.interactions.forEach(interaction => {
        if (!testedDescriptions.has(interaction.description)) {
          uncoveredInteractions.push({
            contract: contractId,
            interaction: interaction.description
          });
        }
      });
    });

    const overallCoverage = totalInteractions > 0 ? (coveredInteractions / totalInteractions) * 100 : 0;

    return {
      overallCoverage,
      contractCoverage,
      uncoveredInteractions
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(testResults: ContractTestResult[]): {
    averageDuration: number;
    slowestTests: { contractId: string; duration: number }[];
    fastestTests: { contractId: string; duration: number }[];
    performanceTrends: { date: string; averageDuration: number }[];
    recommendations: string[];
  } {
    if (testResults.length === 0) {
      return {
        averageDuration: 0,
        slowestTests: [],
        fastestTests: [],
        performanceTrends: [],
        recommendations: []
      };
    }

    const durations = testResults.map(r => ({ contractId: r.contractId, duration: r.duration }));
    const averageDuration = durations.reduce((sum, d) => sum + d.duration, 0) / durations.length;

    const slowestTests = durations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    const fastestTests = durations
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 5);

    // Group by date for trends (simplified)
    const performanceTrends = this.groupTestsByDate(testResults).map(group => ({
      date: group.date,
      averageDuration: group.tests.reduce((sum, t) => sum + t.duration, 0) / group.tests.length
    }));

    const recommendations = this.generatePerformanceRecommendations(averageDuration, slowestTests);

    return {
      averageDuration,
      slowestTests,
      fastestTests,
      performanceTrends,
      recommendations
    };
  }

  /**
   * Export report data for external tools
   */
  exportReportData(
    report: ContractReport,
    format: 'json' | 'csv' | 'xml'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'csv':
        return this.convertToCSV(report);
      
      case 'xml':
        return this.convertToXML(report);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private calculateSummary(
    testResults: ContractTestResult[],
    compatibilityResults?: CompatibilityResult[]
  ): ReportSummary {
    const totalContracts = testResults.length;
    const totalInteractions = testResults.reduce((sum, r) => sum + r.summary.totalInteractions, 0);
    const passedTests = testResults.filter(r => r.status === 'passed').length;
    const failedTests = testResults.filter(r => r.status === 'failed').length;
    const overallPassRate = totalContracts > 0 ? (passedTests / totalContracts) * 100 : 0;
    const averageTestDuration = testResults.length > 0 
      ? testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length 
      : 0;

    let criticalIssues = 0;
    let warnings = 0;

    testResults.forEach(result => {
      criticalIssues += result.errors.filter(e => e.type === 'validation' || e.type === 'timeout').length;
      warnings += result.errors.filter(e => e.type === 'network').length;
    });

    if (compatibilityResults) {
      compatibilityResults.forEach(result => {
        criticalIssues += result.breakingChanges.filter(c => c.severity === 'major').length;
        warnings += result.warnings.length;
      });
    }

    return {
      totalContracts,
      totalInteractions,
      passedTests,
      failedTests,
      overallPassRate,
      averageTestDuration,
      criticalIssues,
      warnings
    };
  }

  private calculateMetrics(
    testResults: ContractTestResult[],
    historicalData?: TrendData[]
  ): ContractMetrics {
    const totalContracts = testResults.length;
    const activeContracts = testResults.filter(r => r.status !== 'skipped').length;
    const testCoverage = this.calculateTestCoverage(testResults);
    const averageTestDuration = testResults.length > 0 
      ? testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length 
      : 0;
    const failureRate = testResults.length > 0 
      ? (testResults.filter(r => r.status === 'failed').length / testResults.length) * 100 
      : 0;

    // Calculate breaking change rate (would need more data)
    const breakingChangeRate = 0; // Placeholder

    const trendsOverTime = historicalData || [];

    return {
      totalContracts,
      activeContracts,
      testCoverage,
      averageTestDuration,
      failureRate,
      breakingChangeRate,
      trendsOverTime
    };
  }

  private calculateTestCoverage(testResults: ContractTestResult[]): number {
    if (testResults.length === 0) return 0;

    const totalInteractions = testResults.reduce((sum, r) => sum + r.summary.totalInteractions, 0);
    const passedInteractions = testResults.reduce((sum, r) => sum + r.summary.passedInteractions, 0);

    return totalInteractions > 0 ? (passedInteractions / totalInteractions) * 100 : 0;
  }

  private generateCharts(
    testResults: ContractTestResult[],
    historicalData?: TrendData[],
    summary?: ReportSummary
  ): ChartData[] {
    const charts: ChartData[] = [];

    // Pass/Fail pie chart
    if (summary) {
      charts.push({
        id: 'pass-fail-chart',
        type: 'pie',
        title: 'Test Results Distribution',
        data: {
          labels: ['Passed', 'Failed'],
          datasets: [{
            data: [summary.passedTests, summary.failedTests],
            backgroundColor: ['#28a745', '#dc3545'],
            borderWidth: 2
          }]
        }
      });
    }

    // Test duration bar chart
    if (testResults.length > 0) {
      const contractNames = testResults.map(r => r.contractId);
      const durations = testResults.map(r => r.duration);

      charts.push({
        id: 'duration-chart',
        type: 'bar',
        title: 'Test Duration by Contract',
        data: {
          labels: contractNames,
          datasets: [{
            label: 'Duration (ms)',
            data: durations,
            backgroundColor: '#007bff',
            borderColor: '#0056b3',
            borderWidth: 1
          }]
        }
      });
    }

    // Historical trends line chart
    if (historicalData && historicalData.length > 0) {
      charts.push({
        id: 'trends-chart',
        type: 'line',
        title: 'Test Trends Over Time',
        data: {
          labels: historicalData.map(d => d.date),
          datasets: [
            {
              label: 'Pass Rate (%)',
              data: historicalData.map(d => d.passRate),
              borderColor: '#28a745',
              backgroundColor: 'rgba(40, 167, 69, 0.1)',
              tension: 0.4
            },
            {
              label: 'Test Count',
              data: historicalData.map(d => d.testCount),
              borderColor: '#007bff',
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              tension: 0.4,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left'
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: {
                drawOnChartArea: false
              }
            }
          }
        }
      });
    }

    return charts;
  }

  private generateAlerts(
    testResults: ContractTestResult[],
    compatibilityResults?: CompatibilityResult[]
  ): { level: 'error' | 'warning' | 'info'; message: string; timestamp: Date }[] {
    const alerts: any[] = [];

    // Test failure alerts
    testResults.filter(r => r.status === 'failed').forEach(result => {
      alerts.push({
        level: 'error',
        message: `Contract test failed: ${result.contractId}`,
        timestamp: result.endTime
      });
    });

    // Compatibility alerts
    compatibilityResults?.forEach(result => {
      if (!result.isCompatible) {
        alerts.push({
          level: 'error',
          message: `Breaking changes detected in contract`,
          timestamp: new Date()
        });
      }

      if (result.warnings.length > 0) {
        alerts.push({
          level: 'warning',
          message: `${result.warnings.length} compatibility warnings found`,
          timestamp: new Date()
        });
      }
    });

    // Performance alerts
    const slowTests = testResults.filter(r => r.duration > 30000); // 30 seconds
    if (slowTests.length > 0) {
      alerts.push({
        level: 'warning',
        message: `${slowTests.length} tests are running slowly (>30s)`,
        timestamp: new Date()
      });
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private async renderReport(report: ContractReport, options: ReportOptions): Promise<string> {
    const fileName = `contract-report-${report.id}.${options.format}`;
    const filePath = join(options.outputDir, fileName);

    let content: string;

    switch (options.format) {
      case 'html':
        content = this.renderHTMLReport(report, options);
        break;
      case 'json':
        content = JSON.stringify(report, null, 2);
        break;
      case 'junit':
        content = this.renderJUnitReport(report);
        break;
      case 'markdown':
        content = this.renderMarkdownReport(report, options);
        break;
      default:
        throw new Error(`Unsupported report format: ${options.format}`);
    }

    writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  private renderHTMLReport(report: ContractReport, options: ReportOptions): string {
    const theme = options.theme || 'light';
    const includeCharts = options.includeCharts && report.charts;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: ${theme === 'dark' ? '#ffffff' : '#333333'};
            background-color: ${theme === 'dark' ? '#1a1a1a' : '#ffffff'};
            margin: 0;
            padding: 20px;
        }
        
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card {
            background: ${theme === 'dark' ? '#2d2d2d' : '#f8f9fa'};
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: ${theme === 'dark' ? '#cccccc' : '#666666'}; margin-top: 5px; }
        
        .test-results { margin-bottom: 30px; }
        .test-result {
            background: ${theme === 'dark' ? '#2d2d2d' : '#f8f9fa'};
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .test-result.failed { border-left-color: #dc3545; }
        .test-result.passed { border-left-color: #28a745; }
        
        .chart-container { margin: 20px 0; padding: 20px; background: ${theme === 'dark' ? '#2d2d2d' : '#f8f9fa'}; border-radius: 8px; }
        
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid ${theme === 'dark' ? '#404040' : '#ddd'}; }
        th { background: ${theme === 'dark' ? '#404040' : '#f5f5f5'}; font-weight: bold; }
        
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
    </style>
    ${includeCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : ''}
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${report.title}</h1>
            <p>Generated on ${report.generatedAt.toISOString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalContracts}</div>
                <div class="metric-label">Total Contracts</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.overallPassRate.toFixed(1)}%</div>
                <div class="metric-label">Pass Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.passedTests}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.failedTests}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.averageTestDuration.toFixed(0)}ms</div>
                <div class="metric-label">Avg Duration</div>
            </div>
        </div>
        
        ${includeCharts ? this.renderChartsHTML(report.charts!) : ''}
        
        <div class="test-results">
            <h2>Test Results</h2>
            ${report.testResults.map(result => `
                <div class="test-result ${result.status}">
                    <h3>${result.contractId} <span class="status-badge status-${result.status}">${result.status.toUpperCase()}</span></h3>
                    <p><strong>Duration:</strong> ${result.duration}ms</p>
                    <p><strong>Pass Rate:</strong> ${result.summary.passRate.toFixed(1)}%</p>
                    <p><strong>Interactions:</strong> ${result.summary.totalInteractions} total, ${result.summary.passedInteractions} passed</p>
                    ${result.errors.length > 0 ? `
                        <details>
                            <summary>Errors (${result.errors.length})</summary>
                            <ul>
                                ${result.errors.map(error => `<li>${error.message}</li>`).join('')}
                            </ul>
                        </details>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        
        ${options.includeCompatibilityMatrix && report.matrixSummary ? `
            <div class="compatibility-matrix">
                <h2>Compatibility Matrix</h2>
                <table>
                    <tr>
                        <td><strong>Total Combinations</strong></td>
                        <td>${report.matrixSummary.totalCombinations}</td>
                    </tr>
                    <tr>
                        <td><strong>Compatible</strong></td>
                        <td>${report.matrixSummary.compatibleCombinations}</td>
                    </tr>
                    <tr>
                        <td><strong>Incompatible</strong></td>
                        <td>${report.matrixSummary.incompatibleCombinations}</td>
                    </tr>
                    <tr>
                        <td><strong>Average Score</strong></td>
                        <td>${report.matrixSummary.averageCompatibilityScore.toFixed(1)}%</td>
                    </tr>
                </table>
            </div>
        ` : ''}
    </div>
</body>
</html>`;
  }

  private renderChartsHTML(charts: ChartData[]): string {
    if (!charts || charts.length === 0) return '';

    const chartsHTML = charts.map(chart => `
        <div class="chart-container">
            <h3>${chart.title}</h3>
            <canvas id="${chart.id}" width="400" height="200"></canvas>
            <script>
                new Chart(document.getElementById('${chart.id}'), {
                    type: '${chart.type}',
                    data: ${JSON.stringify(chart.data)},
                    options: ${JSON.stringify(chart.options || {})}
                });
            </script>
        </div>
    `).join('');

    return `<div class="charts-section"><h2>Charts</h2>${chartsHTML}</div>`;
  }

  private renderJUnitReport(report: ContractReport): string {
    const totalTests = report.testResults.length;
    const failures = report.testResults.filter(r => r.status === 'failed').length;
    const errors = report.testResults.reduce((sum, r) => sum + r.errors.length, 0);
    const time = report.testResults.reduce((sum, r) => sum + r.duration, 0) / 1000; // Convert to seconds

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="Contract Tests" tests="${totalTests}" failures="${failures}" errors="${errors}" time="${time.toFixed(3)}">\n`;

    report.testResults.forEach(result => {
      const testTime = result.duration / 1000;
      xml += `  <testcase classname="${result.testSuite}" name="${result.contractId}" time="${testTime.toFixed(3)}">\n`;
      
      if (result.status === 'failed') {
        xml += `    <failure message="Contract test failed">\n`;
        result.errors.forEach(error => {
          xml += `      ${this.escapeXml(error.message)}\n`;
        });
        xml += `    </failure>\n`;
      }
      
      xml += `  </testcase>\n`;
    });

    xml += `</testsuite>\n`;
    return xml;
  }

  private renderMarkdownReport(report: ContractReport, options: ReportOptions): string {
    let content = `# ${report.title}\n\n`;
    content += `**Generated:** ${report.generatedAt.toISOString()}\n\n`;

    // Summary section
    content += `## Summary\n\n`;
    content += `| Metric | Value |\n`;
    content += `|--------|-------|\n`;
    content += `| Total Contracts | ${report.summary.totalContracts} |\n`;
    content += `| Pass Rate | ${report.summary.overallPassRate.toFixed(1)}% |\n`;
    content += `| Passed Tests | ${report.summary.passedTests} |\n`;
    content += `| Failed Tests | ${report.summary.failedTests} |\n`;
    content += `| Average Duration | ${report.summary.averageTestDuration.toFixed(0)}ms |\n`;
    content += `| Critical Issues | ${report.summary.criticalIssues} |\n`;
    content += `| Warnings | ${report.summary.warnings} |\n\n`;

    // Test Results section
    content += `## Test Results\n\n`;
    report.testResults.forEach(result => {
      const status = result.status === 'passed' ? '✅' : '❌';
      content += `### ${status} ${result.contractId}\n\n`;
      content += `- **Status:** ${result.status.toUpperCase()}\n`;
      content += `- **Duration:** ${result.duration}ms\n`;
      content += `- **Pass Rate:** ${result.summary.passRate.toFixed(1)}%\n`;
      content += `- **Interactions:** ${result.summary.totalInteractions} total, ${result.summary.passedInteractions} passed\n`;
      
      if (result.errors.length > 0) {
        content += `\n**Errors:**\n`;
        result.errors.forEach(error => {
          content += `- ${error.message}\n`;
        });
      }
      content += `\n`;
    });

    return content;
  }

  private convertToCSV(report: ContractReport): string {
    const headers = [
      'Contract ID',
      'Status',
      'Duration (ms)',
      'Pass Rate (%)',
      'Total Interactions',
      'Passed Interactions',
      'Failed Interactions',
      'Errors'
    ];

    let csv = headers.join(',') + '\n';

    report.testResults.forEach(result => {
      const row = [
        result.contractId,
        result.status,
        result.duration,
        result.summary.passRate.toFixed(1),
        result.summary.totalInteractions,
        result.summary.passedInteractions,
        result.summary.failedInteractions,
        result.errors.length
      ];
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  private convertToXML(report: ContractReport): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<contractReport id="${report.id}" generated="${report.generatedAt.toISOString()}">\n`;
    xml += `  <title>${this.escapeXml(report.title)}</title>\n`;
    
    // Summary
    xml += `  <summary>\n`;
    xml += `    <totalContracts>${report.summary.totalContracts}</totalContracts>\n`;
    xml += `    <passRate>${report.summary.overallPassRate}</passRate>\n`;
    xml += `    <passedTests>${report.summary.passedTests}</passedTests>\n`;
    xml += `    <failedTests>${report.summary.failedTests}</failedTests>\n`;
    xml += `  </summary>\n`;
    
    // Test Results
    xml += `  <testResults>\n`;
    report.testResults.forEach(result => {
      xml += `    <testResult>\n`;
      xml += `      <contractId>${this.escapeXml(result.contractId)}</contractId>\n`;
      xml += `      <status>${result.status}</status>\n`;
      xml += `      <duration>${result.duration}</duration>\n`;
      xml += `      <passRate>${result.summary.passRate}</passRate>\n`;
      xml += `    </testResult>\n`;
    });
    xml += `  </testResults>\n`;
    
    xml += `</contractReport>\n`;
    return xml;
  }

  private groupTestsByDate(testResults: ContractTestResult[]): { date: string; tests: ContractTestResult[] }[] {
    const grouped = testResults.reduce((acc, test) => {
      const date = test.endTime.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(test);
      return acc;
    }, {} as Record<string, ContractTestResult[]>);

    return Object.entries(grouped).map(([date, tests]) => ({ date, tests }));
  }

  private generatePerformanceRecommendations(
    averageDuration: number,
    slowestTests: { contractId: string; duration: number }[]
  ): string[] {
    const recommendations: string[] = [];

    if (averageDuration > 10000) { // 10 seconds
      recommendations.push('Overall test duration is high. Consider optimizing test setup and teardown.');
    }

    if (slowestTests.length > 0) {
      recommendations.push(`Review slow tests: ${slowestTests.map(t => t.contractId).join(', ')}`);
    }

    if (slowestTests.some(t => t.duration > 60000)) { // 1 minute
      recommendations.push('Some tests are taking over 1 minute. Check for network timeouts or complex setup.');
    }

    return recommendations;
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}