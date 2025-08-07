/**
 * Quality Gate Engine
 * Intelligent quality gates that ensure service reliability and quality
 */

import { EventEmitter } from 'events';
import { TestResult, QualityGateThresholds } from './TestingFramework';

export interface QualityGate {
  id: string;
  name: string;
  type: 'coverage' | 'performance' | 'security' | 'reliability' | 'custom';
  condition: QualityGateCondition;
  severity: 'blocker' | 'critical' | 'major' | 'minor';
  enabled: boolean;
  description: string;
}

export interface QualityGateCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'not_contains';
  value: number | string | boolean;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface QualityGateResult {
  gate: QualityGate;
  status: 'passed' | 'failed' | 'skipped';
  actualValue: any;
  expectedValue: any;
  message: string;
  timestamp: Date;
}

export interface QualityGateEvaluation {
  status: 'passed' | 'failed' | 'warning';
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  results: QualityGateResult[];
  summary: string;
  recommendations: string[];
}

export interface QualityGateConfig {
  enabled: boolean;
  strictMode: boolean;
  thresholds: QualityGateThresholds;
}

export class QualityGateEngine extends EventEmitter {
  private config: QualityGateConfig;
  private gates: Map<string, QualityGate> = new Map();
  private lastEvaluation?: QualityGateEvaluation;

  constructor(config: QualityGateConfig) {
    super();
    this.config = config;
    this.initializeDefaultGates();
  }

  /**
   * Register a custom quality gate
   */
  public registerGate(gate: QualityGate): void {
    this.gates.set(gate.id, gate);
    this.emit('gate:registered', gate);
  }

  /**
   * Remove a quality gate
   */
  public removeGate(gateId: string): boolean {
    const removed = this.gates.delete(gateId);
    if (removed) {
      this.emit('gate:removed', gateId);
    }
    return removed;
  }

  /**
   * Evaluate all quality gates against test results
   */
  public async evaluate(testResults: Map<string, TestResult>): Promise<QualityGateEvaluation> {
    if (!this.config.enabled) {
      return this.createSkippedEvaluation();
    }

    const results: QualityGateResult[] = [];
    const enabledGates = Array.from(this.gates.values()).filter(gate => gate.enabled);

    for (const gate of enabledGates) {
      try {
        const result = await this.evaluateGate(gate, testResults);
        results.push(result);
        
        if (result.status === 'passed') {
          this.emit('gate:passed', result);
        } else if (result.status === 'failed') {
          this.emit('gate:failed', result);
        }
      } catch (error) {
        results.push({
          gate,
          status: 'failed',
          actualValue: null,
          expectedValue: gate.condition.value,
          message: `Error evaluating gate: ${error.message}`,
          timestamp: new Date()
        });
        this.emit('gate:error', gate, error);
      }
    }

    const evaluation = this.createEvaluation(results);
    this.lastEvaluation = evaluation;
    
    this.emit('evaluation:completed', evaluation);
    return evaluation;
  }

  /**
   * Get the status of the last evaluation
   */
  public getStatus(): QualityGateEvaluation | null {
    return this.lastEvaluation || null;
  }

  /**
   * Health check for the quality gate engine
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if configuration is valid
      if (!this.config || typeof this.config.enabled !== 'boolean') {
        return false;
      }

      // Check if thresholds are properly configured
      const thresholds = this.config.thresholds;
      if (!thresholds || !thresholds.coverage || !thresholds.performance) {
        return false;
      }

      // Check if gates are properly registered
      if (this.gates.size === 0) {
        return false;
      }

      return true;
    } catch (error) {
      this.emit('health-check:failed', error);
      return false;
    }
  }

  private async evaluateGate(gate: QualityGate, testResults: Map<string, TestResult>): Promise<QualityGateResult> {
    const actualValue = this.extractMetricValue(gate.condition.metric, testResults, gate.condition.aggregation);
    const expectedValue = gate.condition.value;
    
    const passed = this.evaluateCondition(actualValue, gate.condition.operator, expectedValue);
    
    return {
      gate,
      status: passed ? 'passed' : 'failed',
      actualValue,
      expectedValue,
      message: this.generateGateMessage(gate, actualValue, expectedValue, passed),
      timestamp: new Date()
    };
  }

  private extractMetricValue(metric: string, testResults: Map<string, TestResult>, aggregation?: string): any {
    const results = Array.from(testResults.values());
    
    // Handle different metric types
    switch (metric) {
      case 'test.pass_rate':
        const passed = results.filter(r => r.status === 'passed').length;
        return results.length > 0 ? (passed / results.length) * 100 : 0;
        
      case 'test.duration_avg':
        return results.length > 0 ? results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0;
        
      case 'test.failed_count':
        return results.filter(r => r.status === 'failed').length;
        
      case 'coverage.lines':
        return this.aggregateCoverage(results, 'lines', aggregation);
        
      case 'coverage.functions':
        return this.aggregateCoverage(results, 'functions', aggregation);
        
      case 'coverage.branches':
        return this.aggregateCoverage(results, 'branches', aggregation);
        
      case 'coverage.statements':
        return this.aggregateCoverage(results, 'statements', aggregation);
        
      case 'performance.response_time_avg':
        return this.aggregatePerformance(results, 'responseTime', 'avg', aggregation);
        
      case 'performance.throughput':
        return this.aggregatePerformance(results, 'throughput', null, aggregation);
        
      case 'performance.error_rate':
        return this.aggregatePerformance(results, 'errorRate', null, aggregation);
        
      case 'security.vulnerabilities.critical':
        return this.aggregateSecurity(results, 'vulnerabilities', 'critical', aggregation);
        
      case 'security.vulnerabilities.high':
        return this.aggregateSecurity(results, 'vulnerabilities', 'high', aggregation);
        
      case 'security.compliance.score':
        return this.aggregateSecurity(results, 'compliance', 'score', aggregation);
        
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private aggregateCoverage(results: TestResult[], type: keyof TestResult['coverage'], aggregation?: string): number {
    const coverageResults = results
      .map(r => r.coverage?.[type]?.percentage)
      .filter(v => v !== undefined) as number[];
      
    if (coverageResults.length === 0) return 0;
    
    switch (aggregation) {
      case 'min': return Math.min(...coverageResults);
      case 'max': return Math.max(...coverageResults);
      case 'sum': return coverageResults.reduce((sum, v) => sum + v, 0);
      case 'avg':
      default:
        return coverageResults.reduce((sum, v) => sum + v, 0) / coverageResults.length;
    }
  }

  private aggregatePerformance(results: TestResult[], metric: string, subMetric?: string, aggregation?: string): number {
    const performanceResults = results
      .map(r => {
        if (!r.performance) return undefined;
        const perfData = r.performance[metric as keyof TestResult['performance']];
        return subMetric && typeof perfData === 'object' ? perfData[subMetric] : perfData;
      })
      .filter(v => v !== undefined) as number[];
      
    if (performanceResults.length === 0) return 0;
    
    switch (aggregation) {
      case 'min': return Math.min(...performanceResults);
      case 'max': return Math.max(...performanceResults);
      case 'sum': return performanceResults.reduce((sum, v) => sum + v, 0);
      case 'avg':
      default:
        return performanceResults.reduce((sum, v) => sum + v, 0) / performanceResults.length;
    }
  }

  private aggregateSecurity(results: TestResult[], category: string, type: string, aggregation?: string): number {
    const securityResults = results
      .map(r => {
        if (!r.security) return undefined;
        const secData = r.security[category as keyof TestResult['security']];
        return typeof secData === 'object' ? secData[type] : secData;
      })
      .filter(v => v !== undefined) as number[];
      
    if (securityResults.length === 0) return 0;
    
    switch (aggregation) {
      case 'min': return Math.min(...securityResults);
      case 'max': return Math.max(...securityResults);
      case 'avg': return securityResults.reduce((sum, v) => sum + v, 0) / securityResults.length;
      case 'sum':
      default:
        return securityResults.reduce((sum, v) => sum + v, 0);
    }
  }

  private evaluateCondition(actualValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'gt': return actualValue > expectedValue;
      case 'gte': return actualValue >= expectedValue;
      case 'lt': return actualValue < expectedValue;
      case 'lte': return actualValue <= expectedValue;
      case 'eq': return actualValue === expectedValue;
      case 'neq': return actualValue !== expectedValue;
      case 'contains': return String(actualValue).includes(String(expectedValue));
      case 'not_contains': return !String(actualValue).includes(String(expectedValue));
      default: return false;
    }
  }

  private generateGateMessage(gate: QualityGate, actualValue: any, expectedValue: any, passed: boolean): string {
    const status = passed ? 'PASSED' : 'FAILED';
    const comparison = this.getComparisonText(gate.condition.operator);
    
    return `${gate.name} ${status}: ${actualValue} ${comparison} ${expectedValue}`;
  }

  private getComparisonText(operator: string): string {
    switch (operator) {
      case 'gt': return 'is greater than';
      case 'gte': return 'is greater than or equal to';
      case 'lt': return 'is less than';
      case 'lte': return 'is less than or equal to';
      case 'eq': return 'equals';
      case 'neq': return 'does not equal';
      case 'contains': return 'contains';
      case 'not_contains': return 'does not contain';
      default: return 'compared to';
    }
  }

  private createEvaluation(results: QualityGateResult[]): QualityGateEvaluation {
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const total = results.length;

    const status = this.determineOverallStatus(results);
    
    return {
      status,
      passed,
      failed,
      skipped,
      total,
      results,
      summary: this.generateSummary(status, passed, failed, skipped, total),
      recommendations: this.generateRecommendations(results)
    };
  }

  private createSkippedEvaluation(): QualityGateEvaluation {
    return {
      status: 'warning',
      passed: 0,
      failed: 0,
      skipped: 1,
      total: 1,
      results: [],
      summary: 'Quality gates are disabled',
      recommendations: ['Consider enabling quality gates for better quality assurance']
    };
  }

  private determineOverallStatus(results: QualityGateResult[]): 'passed' | 'failed' | 'warning' {
    const failedBlockers = results.filter(r => r.status === 'failed' && r.gate.severity === 'blocker');
    const failedCritical = results.filter(r => r.status === 'failed' && r.gate.severity === 'critical');
    
    if (failedBlockers.length > 0) return 'failed';
    if (this.config.strictMode && failedCritical.length > 0) return 'failed';
    if (results.some(r => r.status === 'failed')) return 'warning';
    
    return 'passed';
  }

  private generateSummary(status: string, passed: number, failed: number, skipped: number, total: number): string {
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    return `Quality Gates ${status.toUpperCase()}: ${passed}/${total} gates passed (${passRate}% pass rate)`;
  }

  private generateRecommendations(results: QualityGateResult[]): string[] {
    const recommendations: string[] = [];
    const failedResults = results.filter(r => r.status === 'failed');
    
    if (failedResults.length > 0) {
      recommendations.push(`Fix ${failedResults.length} failing quality gates`);
      
      // Add specific recommendations based on gate types
      const coverageGates = failedResults.filter(r => r.gate.type === 'coverage');
      if (coverageGates.length > 0) {
        recommendations.push('Increase test coverage to meet quality standards');
      }
      
      const performanceGates = failedResults.filter(r => r.gate.type === 'performance');
      if (performanceGates.length > 0) {
        recommendations.push('Optimize application performance to meet SLA requirements');
      }
      
      const securityGates = failedResults.filter(r => r.gate.type === 'security');
      if (securityGates.length > 0) {
        recommendations.push('Address security vulnerabilities before deployment');
      }
    }
    
    return recommendations;
  }

  private initializeDefaultGates(): void {
    const thresholds = this.config.thresholds;
    
    // Coverage gates
    this.registerGate({
      id: 'coverage-lines',
      name: 'Line Coverage',
      type: 'coverage',
      condition: {
        metric: 'coverage.lines',
        operator: 'gte',
        value: thresholds.coverage.lines,
        aggregation: 'avg'
      },
      severity: 'major',
      enabled: true,
      description: 'Ensures minimum line coverage threshold is met'
    });

    this.registerGate({
      id: 'coverage-functions',
      name: 'Function Coverage',
      type: 'coverage',
      condition: {
        metric: 'coverage.functions',
        operator: 'gte',
        value: thresholds.coverage.functions,
        aggregation: 'avg'
      },
      severity: 'major',
      enabled: true,
      description: 'Ensures minimum function coverage threshold is met'
    });

    // Performance gates
    this.registerGate({
      id: 'performance-response-time',
      name: 'Response Time',
      type: 'performance',
      condition: {
        metric: 'performance.response_time_avg',
        operator: 'lte',
        value: thresholds.performance.responseTime,
        aggregation: 'avg'
      },
      severity: 'critical',
      enabled: true,
      description: 'Ensures response time meets performance requirements'
    });

    this.registerGate({
      id: 'performance-error-rate',
      name: 'Error Rate',
      type: 'performance',
      condition: {
        metric: 'performance.error_rate',
        operator: 'lte',
        value: thresholds.performance.errorRate,
        aggregation: 'max'
      },
      severity: 'critical',
      enabled: true,
      description: 'Ensures error rate stays within acceptable limits'
    });

    // Security gates
    this.registerGate({
      id: 'security-critical-vulnerabilities',
      name: 'Critical Vulnerabilities',
      type: 'security',
      condition: {
        metric: 'security.vulnerabilities.critical',
        operator: 'lte',
        value: thresholds.security.vulnerabilities.critical,
        aggregation: 'sum'
      },
      severity: 'blocker',
      enabled: true,
      description: 'Blocks deployment if critical vulnerabilities are found'
    });

    this.registerGate({
      id: 'security-high-vulnerabilities',
      name: 'High Vulnerabilities',
      type: 'security',
      condition: {
        metric: 'security.vulnerabilities.high',
        operator: 'lte',
        value: thresholds.security.vulnerabilities.high,
        aggregation: 'sum'
      },
      severity: 'major',
      enabled: true,
      description: 'Warns about high-severity vulnerabilities'
    });

    // Test quality gates
    this.registerGate({
      id: 'test-pass-rate',
      name: 'Test Pass Rate',
      type: 'reliability',
      condition: {
        metric: 'test.pass_rate',
        operator: 'gte',
        value: 95
      },
      severity: 'critical',
      enabled: true,
      description: 'Ensures high test pass rate for reliability'
    });

    this.registerGate({
      id: 'test-failed-count',
      name: 'Failed Test Count',
      type: 'reliability',
      condition: {
        metric: 'test.failed_count',
        operator: 'eq',
        value: 0
      },
      severity: 'major',
      enabled: true,
      description: 'Ensures no tests are failing'
    });
  }
}

export default QualityGateEngine;