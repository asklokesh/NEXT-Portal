#!/usr/bin/env node

/**
 * Comprehensive Smoke Test Suite for CI/CD Pipeline
 * Automated tests to validate critical functionality before deployment
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  baseUrl: process.env.SMOKE_TEST_URL || 'http://localhost:4400',
  timeout: parseInt(process.env.SMOKE_TEST_TIMEOUT) || 10000,
  maxRetries: parseInt(process.env.SMOKE_TEST_RETRIES) || 3,
  reportPath: process.env.SMOKE_TEST_REPORT || './smoke-test-report.json'
};

// Critical functionality tests
const smokeTests = [
  {
    name: 'Homepage Load',
    type: 'route',
    path: '/',
    expectedStatus: [200, 307], // Allow redirect
    minResponseTime: 0,
    maxResponseTime: 5000,
    contentChecks: ['<!DOCTYPE html>', 'NEXT Portal'],
    critical: false // Not critical since redirects are acceptable
  },
  {
    name: 'Dashboard Access',
    type: 'route',
    path: '/dashboard',
    expectedStatus: [200, 302], // Allow redirect to login
    maxResponseTime: 3000,
    critical: true
  },
  {
    name: 'Plugin Management',
    type: 'route',
    path: '/plugins',
    expectedStatus: [200, 302],
    maxResponseTime: 3000,
    critical: true
  },
  {
    name: 'Service Catalog',
    type: 'route',
    path: '/catalog',
    expectedStatus: [200, 302],
    maxResponseTime: 3000,
    critical: true
  },
  {
    name: 'Templates Marketplace',
    type: 'route',
    path: '/templates/marketplace',
    expectedStatus: [200, 302],
    maxResponseTime: 3000,
    critical: false
  },
  {
    name: 'Backstage Entities API',
    type: 'api',
    path: '/api/backstage/entities',
    expectedStatus: [200, 401],
    maxResponseTime: 2000,
    critical: true,
    contentType: 'application/json'
  },
  {
    name: 'Plugin Health API',
    type: 'api',
    path: '/api/plugin-health',
    expectedStatus: [200, 401],
    maxResponseTime: 2000,
    critical: true,
    contentType: 'application/json'
  },
  {
    name: 'Plugins API',
    type: 'api',
    path: '/api/plugins',
    expectedStatus: [200, 401],
    maxResponseTime: 2000,
    critical: true,
    contentType: 'application/json'
  },
  {
    name: 'Metrics API',
    type: 'api',
    path: '/api/metrics',
    expectedStatus: [200, 401],
    maxResponseTime: 2000,
    critical: false,
    contentType: 'application/json'
  },
  {
    name: 'Error Tracking API',
    type: 'api',
    path: '/api/monitoring/errors',
    expectedStatus: [200, 401],
    maxResponseTime: 2000,
    critical: false,
    contentType: 'application/json'
  }
];

// Performance benchmarks
const performanceBenchmarks = {
  homepage: { maxLoadTime: 3000, maxContentfulPaint: 2000 },
  dashboard: { maxLoadTime: 4000, maxContentfulPaint: 2500 },
  api: { maxResponseTime: 1000, maxP95: 2000 }
};

// Security checks
const securityChecks = [
  {
    name: 'Security Headers Check',
    type: 'security',
    path: '/',
    expectedStatus: [200, 307], // Allow redirect
    requiredHeaders: ['x-frame-options', 'x-content-type-options'],
    critical: false
  },
  {
    name: 'HTTPS Redirect Check',
    type: 'security',
    path: '/',
    skipInDev: true,
    critical: false
  }
];

class SmokeTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      critical_failures: 0
    };
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https:');
      const httpModule = isHttps ? https : http;
      const startTime = performance.now();

      const req = httpModule.get(url, {
        timeout: config.timeout,
        ...options
      }, (res) => {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data,
            responseTime,
            contentLength: Buffer.byteLength(data, 'utf8')
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.on('error', reject);
    });
  }

  async runTest(test, retryCount = 0) {
    const testStart = performance.now();
    const result = {
      name: test.name,
      type: test.type,
      path: test.path,
      critical: test.critical,
      status: 'unknown',
      duration: 0,
      error: null,
      details: {},
      retryCount
    };

    try {
      const url = `${config.baseUrl}${test.path}`;
      const response = await this.makeRequest(url);

      result.details = {
        statusCode: response.statusCode,
        responseTime: response.responseTime,
        contentLength: response.contentLength,
        headers: response.headers
      };

      // Check status code
      const expectedStatuses = Array.isArray(test.expectedStatus) 
        ? test.expectedStatus 
        : [test.expectedStatus];
      
      if (!expectedStatuses.includes(response.statusCode)) {
        throw new Error(`Expected status ${expectedStatuses.join(' or ')}, got ${response.statusCode}`);
      }

      // Check response time
      if (test.maxResponseTime && response.responseTime > test.maxResponseTime) {
        throw new Error(`Response time ${response.responseTime}ms exceeds maximum ${test.maxResponseTime}ms`);
      }

      // Check content type for APIs
      if (test.contentType) {
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes(test.contentType)) {
          result.status = 'warning';
          result.error = `Expected content-type ${test.contentType}, got ${contentType}`;
        }
      }

      // Check content for specific strings (skip for redirects)
      if (test.contentChecks && response.statusCode < 300) {
        for (const check of test.contentChecks) {
          if (!response.data.includes(check)) {
            throw new Error(`Content check failed: "${check}" not found in response`);
          }
        }
      }

      // Security header checks
      if (test.type === 'security' && test.requiredHeaders) {
        const missingHeaders = test.requiredHeaders.filter(
          header => !response.headers[header.toLowerCase()]
        );
        if (missingHeaders.length > 0) {
          result.status = 'warning';
          result.error = `Missing security headers: ${missingHeaders.join(', ')}`;
        }
      }

      if (result.status !== 'warning') {
        result.status = 'passed';
      }

    } catch (error) {
      result.error = error.message;
      result.status = 'failed';

      // Retry logic for failed tests
      if (retryCount < config.maxRetries && test.critical) {
        console.log(`⚠️  Retrying ${test.name} (attempt ${retryCount + 1}/${config.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return this.runTest(test, retryCount + 1);
      }
    }

    result.duration = Math.round(performance.now() - testStart);
    return result;
  }

  async runAllTests() {
    console.log('🚀 Starting Smoke Test Suite');
    console.log('='.repeat(50));
    console.log(`Target: ${config.baseUrl}`);
    console.log(`Timeout: ${config.timeout}ms`);
    console.log(`Max Retries: ${config.maxRetries}`);
    console.log('');

    const allTests = [...smokeTests, ...securityChecks];
    
    // Skip dev-only tests in production
    const testsToRun = allTests.filter(test => {
      if (test.skipInDev && config.baseUrl.includes('localhost')) {
        return false;
      }
      return true;
    });

    console.log(`Running ${testsToRun.length} tests...`);
    console.log('');

    // Run tests sequentially to avoid overwhelming the server
    for (const test of testsToRun) {
      console.log(`🧪 Testing: ${test.name}`);
      const result = await this.runTest(test);
      this.results.push(result);
      this.updateStats(result);

      const statusIcon = this.getStatusIcon(result);
      const duration = result.duration ? `(${result.duration}ms)` : '';
      const details = result.details.responseTime ? `[${result.details.statusCode}] ${result.details.responseTime}ms` : '';
      
      console.log(`   ${statusIcon} ${result.status.toUpperCase()} ${details} ${duration}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.retryCount > 0) {
        console.log(`   Succeeded after ${result.retryCount} retries`);
      }
    }

    await this.generateReport();
    this.printSummary();
    return this.shouldExitWithError();
  }

  updateStats(result) {
    this.stats.total++;
    
    switch (result.status) {
      case 'passed':
        this.stats.passed++;
        break;
      case 'failed':
        this.stats.failed++;
        if (result.critical) {
          this.stats.critical_failures++;
        }
        break;
      case 'warning':
        this.stats.warnings++;
        break;
    }
  }

  getStatusIcon(result) {
    switch (result.status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config,
      stats: this.stats,
      duration: Date.now() - this.startTime,
      results: this.results,
      performance: this.analyzePerformance(),
      summary: {
        overall_status: this.getOverallStatus(),
        critical_failures: this.stats.critical_failures,
        recommendations: this.generateRecommendations()
      }
    };

    try {
      const reportDir = path.dirname(config.reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📊 Report generated: ${config.reportPath}`);
    } catch (error) {
      console.error(`Failed to generate report: ${error.message}`);
    }

    return report;
  }

  analyzePerformance() {
    const routeTests = this.results.filter(r => r.type === 'route' && r.status === 'passed');
    const apiTests = this.results.filter(r => r.type === 'api' && r.status === 'passed');

    const performance = {
      routes: {
        avg_response_time: this.calculateAverage(routeTests, 'responseTime'),
        max_response_time: this.calculateMax(routeTests, 'responseTime'),
        slowest_route: this.findSlowest(routeTests)
      },
      apis: {
        avg_response_time: this.calculateAverage(apiTests, 'responseTime'),
        max_response_time: this.calculateMax(apiTests, 'responseTime'),
        slowest_api: this.findSlowest(apiTests)
      }
    };

    return performance;
  }

  calculateAverage(tests, field) {
    if (tests.length === 0) return 0;
    const sum = tests.reduce((acc, test) => acc + (test.details.responseTime || 0), 0);
    return Math.round(sum / tests.length);
  }

  calculateMax(tests, field) {
    if (tests.length === 0) return 0;
    return Math.max(...tests.map(test => test.details.responseTime || 0));
  }

  findSlowest(tests) {
    if (tests.length === 0) return null;
    return tests.reduce((slowest, test) => {
      const currentTime = test.details.responseTime || 0;
      const slowestTime = slowest.details.responseTime || 0;
      return currentTime > slowestTime ? test : slowest;
    });
  }

  generateRecommendations() {
    const recommendations = [];

    // Performance recommendations
    const slowTests = this.results.filter(r => 
      r.details.responseTime && r.details.responseTime > 2000
    );
    
    if (slowTests.length > 0) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: `${slowTests.length} endpoints have response times > 2s`,
        actions: ['Review and optimize slow endpoints', 'Consider caching strategies']
      });
    }

    // Security recommendations
    const securityWarnings = this.results.filter(r => 
      r.type === 'security' && r.status === 'warning'
    );
    
    if (securityWarnings.length > 0) {
      recommendations.push({
        type: 'security',
        severity: 'medium',
        message: 'Missing security headers detected',
        actions: ['Implement security headers middleware', 'Review security configuration']
      });
    }

    // Critical failure recommendations
    if (this.stats.critical_failures > 0) {
      recommendations.push({
        type: 'critical',
        severity: 'high',
        message: `${this.stats.critical_failures} critical test(s) failed`,
        actions: ['Fix critical issues before deployment', 'Review application logs']
      });
    }

    return recommendations;
  }

  getOverallStatus() {
    if (this.stats.critical_failures > 0) return 'CRITICAL';
    if (this.stats.failed > 0) return 'FAILED';
    if (this.stats.warnings > 0) return 'WARNING';
    return 'PASSED';
  }

  printSummary() {
    console.log('');
    console.log('📊 Smoke Test Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.stats.passed}/${this.stats.total}`);
    console.log(`⚠️  Warnings: ${this.stats.warnings}/${this.stats.total}`);
    console.log(`❌ Failed: ${this.stats.failed}/${this.stats.total}`);
    console.log(`🔥 Critical Failures: ${this.stats.critical_failures}`);
    
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log('');

    const overallStatus = this.getOverallStatus();
    const statusIcon = this.getOverallStatusIcon(overallStatus);
    console.log(`${statusIcon} Overall Status: ${overallStatus}`);
    console.log('='.repeat(50));
  }

  getOverallStatusIcon(status) {
    switch (status) {
      case 'PASSED': return '✅';
      case 'WARNING': return '⚠️';
      case 'FAILED': return '❌';
      case 'CRITICAL': return '🔥';
      default: return '❓';
    }
  }

  shouldExitWithError() {
    return this.stats.critical_failures > 0 || this.stats.failed > 0;
  }
}

// CLI execution
if (require.main === module) {
  const runner = new SmokeTestRunner();
  runner.runAllTests()
    .then(shouldFail => {
      process.exit(shouldFail ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Smoke test suite crashed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { SmokeTestRunner, smokeTests, performanceBenchmarks };