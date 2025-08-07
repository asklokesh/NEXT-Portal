/**
 * Performance Tester
 * Advanced performance testing with load scenarios and benchmarking
 */

import { EventEmitter } from 'events';
import { TestSuite, TestResult } from '../TestingFramework';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface PerformanceTestConfig {
  scenarios: LoadScenario[];
  thresholds: PerformanceThresholds;
  environment: EnvironmentConfig;
}

export interface LoadScenario {
  name: string;
  type: 'load' | 'stress' | 'spike' | 'volume' | 'endurance';
  target: string;
  duration: string;
  vus: number; // Virtual users
  rampUp?: string;
  rampDown?: string;
  requests?: RequestPattern[];
  thresholds?: Record<string, string>;
}

export interface RequestPattern {
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  weight: number;
}

export interface PerformanceThresholds {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    min: number;
    target: number;
  };
  errorRate: {
    max: number;
  };
  availability: {
    min: number;
  };
}

export interface EnvironmentConfig {
  baseUrl: string;
  monitoring?: {
    prometheus?: string;
    grafana?: string;
  };
}

export class PerformanceTester extends EventEmitter {
  constructor() {
    super();
  }

  public async execute(suite: TestSuite): Promise<TestResult> {
    this.emit('test:started', suite);
    const startTime = Date.now();

    try {
      const config = this.parsePerformanceConfig(suite);
      const results = await this.runPerformanceTests(config, suite.id);
      
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
      // Check if k6 is available
      const { stdout } = await execAsync('k6 version', { timeout: 10000 });
      return stdout.includes('k6');
    } catch (error) {
      return false;
    }
  }

  private async runPerformanceTests(config: PerformanceTestConfig, suiteId: string): Promise<any> {
    const results = {
      scenarios: [] as any[],
      summary: {} as any,
      metrics: {} as any
    };

    // Pre-test environment check
    this.emit('test:progress', { suiteId, phase: 'environment-check' });
    await this.checkEnvironment(config.environment);

    // Execute each scenario
    for (const scenario of config.scenarios) {
      this.emit('test:progress', { suiteId, phase: `scenario-${scenario.name}` });
      const scenarioResult = await this.executeScenario(scenario, config);
      results.scenarios.push(scenarioResult);
    }

    // Generate summary
    results.summary = this.generateSummary(results.scenarios);
    results.metrics = await this.collectSystemMetrics(config.environment);

    return results;
  }

  private async checkEnvironment(environment: EnvironmentConfig): Promise<void> {
    try {
      // Check if target application is responsive
      const response = await axios.get(`${environment.baseUrl}/health`, {
        timeout: 10000
      });
      
      if (response.status !== 200) {
        throw new Error(`Environment check failed: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Environment not ready for performance testing: ${error.message}`);
    }
  }

  private async executeScenario(scenario: LoadScenario, config: PerformanceTestConfig): Promise<any> {
    const startTime = Date.now();

    try {
      // Generate k6 script for the scenario
      const scriptPath = await this.generateK6Script(scenario, config);
      
      // Execute k6 test
      const k6Result = await this.runK6Test(scriptPath, scenario);
      
      // Parse k6 results
      const result = this.parseK6Results(k6Result, scenario);
      
      return {
        scenario: scenario.name,
        type: scenario.type,
        status: this.evaluateScenarioStatus(result, scenario.thresholds),
        duration: Date.now() - startTime,
        metrics: result.metrics,
        thresholds: result.thresholds,
        errors: result.errors
      };
    } catch (error) {
      return {
        scenario: scenario.name,
        type: scenario.type,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async generateK6Script(scenario: LoadScenario, config: PerformanceTestConfig): Promise<string> {
    const script = `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const errorRate = new Counter('errors');
const responseTime = new Trend('response_time', true);

export let options = {
  stages: [
    ${scenario.rampUp ? `{ duration: '${scenario.rampUp}', target: ${scenario.vus} },` : ''}
    { duration: '${scenario.duration}', target: ${scenario.vus} },
    ${scenario.rampDown ? `{ duration: '${scenario.rampDown}', target: 0 },` : ''}
  ],
  thresholds: {
    ${Object.entries(scenario.thresholds || {})
      .map(([key, value]) => `'${key}': ['${value}']`)
      .join(',\n    ')}
  }
};

export default function() {
  const requests = ${JSON.stringify(scenario.requests || [])};
  const baseUrl = '${config.environment.baseUrl}';
  
  ${scenario.requests?.map((req, index) => `
  // Request: ${req.name}
  if (Math.random() < ${req.weight}) {
    const startTime = Date.now();
    const response = http.${req.method.toLowerCase()}(baseUrl + '${req.url}', ${
      req.body ? JSON.stringify(req.body) : 'null'
    }, {
      headers: ${JSON.stringify(req.headers || {})},
    });
    
    const duration = Date.now() - startTime;
    responseTime.add(duration);
    
    const success = check(response, {
      'status is 200-299': (r) => r.status >= 200 && r.status < 300,
    });
    
    if (!success) {
      errorRate.add(1);
    }
  }
  `).join('\n') || ''}
  
  sleep(1);
}
    `.trim();

    const scriptPath = `/tmp/k6-script-${scenario.name}-${Date.now()}.js`;
    const fs = require('fs');
    fs.writeFileSync(scriptPath, script);
    
    return scriptPath;
  }

  private async runK6Test(scriptPath: string, scenario: LoadScenario): Promise<string> {
    const command = `k6 run --out json=${scriptPath}.json ${scriptPath}`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.calculateScenarioTimeout(scenario),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      return stdout;
    } catch (error) {
      throw new Error(`K6 execution failed: ${error.message}`);
    }
  }

  private calculateScenarioTimeout(scenario: LoadScenario): number {
    // Calculate timeout based on scenario duration + overhead
    const durationMs = this.parseDuration(scenario.duration);
    const rampUpMs = scenario.rampUp ? this.parseDuration(scenario.rampUp) : 0;
    const rampDownMs = scenario.rampDown ? this.parseDuration(scenario.rampDown) : 0;
    
    return durationMs + rampUpMs + rampDownMs + 60000; // Add 1 minute overhead
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return 60000; // Default to 1 minute
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 60000;
    }
  }

  private parseK6Results(k6Output: string, scenario: LoadScenario): any {
    try {
      // Parse k6 output (simplified - in production, parse JSON output)
      const lines = k6Output.split('\n');
      const summaryLine = lines.find(line => line.includes('http_req_duration'));
      
      // Extract basic metrics (this is simplified)
      const metrics = {
        http_req_duration: {
          avg: this.extractMetric(k6Output, 'avg='),
          min: this.extractMetric(k6Output, 'min='),
          max: this.extractMetric(k6Output, 'max='),
          p50: this.extractMetric(k6Output, 'p(50)='),
          p95: this.extractMetric(k6Output, 'p(95)='),
          p99: this.extractMetric(k6Output, 'p(99)=')
        },
        http_reqs: {
          count: this.extractMetric(k6Output, 'http_reqs'),
          rate: this.extractMetric(k6Output, 'rate')
        },
        vus: scenario.vus,
        vus_max: scenario.vus
      };

      return {
        metrics,
        thresholds: this.extractThresholds(k6Output),
        errors: this.extractErrors(k6Output)
      };
    } catch (error) {
      throw new Error(`Failed to parse k6 results: ${error.message}`);
    }
  }

  private extractMetric(output: string, metricName: string): number {
    const regex = new RegExp(`${metricName.replace('=', '').replace('(', '\\(').replace(')', '\\)')}[^\\d]*(\\d+(?:\\.\\d+)?)`, 'i');
    const match = output.match(regex);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractThresholds(output: string): any {
    const thresholds = {};
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.includes('✓') || line.includes('✗')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const status = line.includes('✓') ? 'passed' : 'failed';
          const name = parts[parts.length - 1];
          thresholds[name] = status;
        }
      }
    });
    
    return thresholds;
  }

  private extractErrors(output: string): string[] {
    const errors = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.includes('ERROR') || line.includes('WARN')) {
        errors.push(line.trim());
      }
    });
    
    return errors;
  }

  private evaluateScenarioStatus(result: any, thresholds?: Record<string, string>): 'passed' | 'failed' {
    if (!thresholds) return 'passed';
    
    const failedThresholds = Object.values(result.thresholds || {})
      .filter((status: string) => status === 'failed');
      
    return failedThresholds.length > 0 ? 'failed' : 'passed';
  }

  private generateSummary(scenarios: any[]): any {
    const totalDuration = scenarios.reduce((sum, s) => sum + s.duration, 0);
    const passedScenarios = scenarios.filter(s => s.status === 'passed').length;
    const failedScenarios = scenarios.filter(s => s.status === 'failed').length;
    
    return {
      total: scenarios.length,
      passed: passedScenarios,
      failed: failedScenarios,
      passRate: (passedScenarios / scenarios.length) * 100,
      totalDuration,
      averageDuration: totalDuration / scenarios.length
    };
  }

  private async collectSystemMetrics(environment: EnvironmentConfig): Promise<any> {
    const metrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0
    };

    try {
      // If Prometheus is available, collect metrics
      if (environment.monitoring?.prometheus) {
        const prometheusUrl = environment.monitoring.prometheus;
        
        // Query system metrics
        const cpuQuery = await axios.get(`${prometheusUrl}/api/v1/query`, {
          params: { query: 'cpu_usage_percent' }
        });
        
        const memQuery = await axios.get(`${prometheusUrl}/api/v1/query`, {
          params: { query: 'memory_usage_percent' }
        });
        
        if (cpuQuery.data.data.result.length > 0) {
          metrics.cpu = parseFloat(cpuQuery.data.data.result[0].value[1]);
        }
        
        if (memQuery.data.data.result.length > 0) {
          metrics.memory = parseFloat(memQuery.data.data.result[0].value[1]);
        }
      }
    } catch (error) {
      // Silently fail if metrics collection fails
    }

    return metrics;
  }

  private parsePerformanceConfig(suite: TestSuite): PerformanceTestConfig {
    return {
      scenarios: suite.config?.scenarios || this.getDefaultScenarios(),
      thresholds: suite.config?.thresholds || this.getDefaultThresholds(),
      environment: {
        baseUrl: suite.config?.baseUrl || 'http://localhost:4400',
        monitoring: suite.config?.monitoring
      }
    };
  }

  private getDefaultScenarios(): LoadScenario[] {
    return [
      {
        name: 'load-test',
        type: 'load',
        target: '/',
        duration: '5m',
        vus: 10,
        requests: [{
          name: 'homepage',
          method: 'GET',
          url: '/',
          weight: 1
        }]
      }
    ];
  }

  private getDefaultThresholds(): PerformanceThresholds {
    return {
      responseTime: {
        p50: 200,
        p95: 500,
        p99: 1000,
        max: 2000
      },
      throughput: {
        min: 100,
        target: 1000
      },
      errorRate: {
        max: 1
      },
      availability: {
        min: 99.9
      }
    };
  }

  private createTestResult(suite: TestSuite, results: any, duration: number): TestResult {
    const failedScenarios = results.scenarios.filter((s: any) => s.status === 'failed');
    
    // Calculate aggregate performance metrics
    const performanceResult = {
      responseTime: {
        min: Math.min(...results.scenarios.map((s: any) => s.metrics?.http_req_duration?.min || 0)),
        max: Math.max(...results.scenarios.map((s: any) => s.metrics?.http_req_duration?.max || 0)),
        avg: results.scenarios.reduce((sum: number, s: any) => 
          sum + (s.metrics?.http_req_duration?.avg || 0), 0) / results.scenarios.length,
        p50: results.scenarios.reduce((sum: number, s: any) => 
          sum + (s.metrics?.http_req_duration?.p50 || 0), 0) / results.scenarios.length,
        p95: results.scenarios.reduce((sum: number, s: any) => 
          sum + (s.metrics?.http_req_duration?.p95 || 0), 0) / results.scenarios.length,
        p99: results.scenarios.reduce((sum: number, s: any) => 
          sum + (s.metrics?.http_req_duration?.p99 || 0), 0) / results.scenarios.length
      },
      throughput: results.scenarios.reduce((sum: number, s: any) => 
        sum + (s.metrics?.http_reqs?.rate || 0), 0),
      errorRate: 0, // Calculate from scenarios
      concurrency: Math.max(...results.scenarios.map((s: any) => s.metrics?.vus || 0)),
      memoryUsage: results.metrics?.memory || 0,
      cpuUsage: results.metrics?.cpu || 0
    };

    return {
      suiteId: suite.id,
      status: failedScenarios.length > 0 ? 'failed' : 'passed',
      duration,
      performance: performanceResult,
      errors: failedScenarios.flatMap((scenario: any) => 
        (scenario.errors || []).map((error: string) => ({
          message: error,
          type: 'PerformanceError'
        }))
      ),
      metrics: {
        executionTime: duration,
        memoryUsage: results.metrics?.memory || 0,
        cpuUsage: results.metrics?.cpu || 0,
        networkCalls: results.scenarios.reduce((sum: number, s: any) => 
          sum + (s.metrics?.http_reqs?.count || 0), 0),
        databaseQueries: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      timestamp: new Date(),
      artifacts: [
        `performance-report-${suite.id}-${Date.now()}.json`,
        `k6-results-${suite.id}-${Date.now()}.json`
      ]
    };
  }
}

export default PerformanceTester;