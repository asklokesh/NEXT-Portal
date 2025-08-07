#!/usr/bin/env tsx

/**
 * Comprehensive Test Runner
 * Executes the advanced testing framework for the SaaS IDP platform
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import TestingFramework, { TestSuite } from '../../src/lib/testing/TestingFramework';
import { getTestingConfig, createTestingConfig } from '../../src/lib/testing/config/TestingFrameworkConfig';

interface TestRunnerOptions {
  environment?: 'development' | 'staging' | 'production';
  suites?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];
  failFast?: boolean;
  parallel?: boolean;
  coverage?: boolean;
  reporting?: boolean;
  qualityGates?: boolean;
  verbose?: boolean;
}

class ComprehensiveTestRunner {
  private framework: TestingFramework;
  private options: TestRunnerOptions;

  constructor(options: TestRunnerOptions = {}) {
    this.options = {
      environment: 'development',
      failFast: false,
      parallel: true,
      coverage: true,
      reporting: true,
      qualityGates: true,
      verbose: false,
      ...options
    };

    // Create configuration based on options
    const baseConfig = getTestingConfig(this.options.environment);
    const customConfig = createTestingConfig({
      ...baseConfig,
      framework: {
        ...baseConfig.framework,
        failFast: this.options.failFast,
        parallel: this.options.parallel
      },
      qualityGates: {
        ...baseConfig.qualityGates,
        enabled: this.options.qualityGates
      },
      reporting: {
        ...baseConfig.reporting,
        enabled: this.options.reporting
      }
    });

    this.framework = new TestingFramework(customConfig);
    this.setupEventHandlers();
  }

  /**
   * Run comprehensive tests
   */
  public async run(): Promise<void> {
    try {
      console.log('🚀 Starting Comprehensive Test Suite');
      console.log(`Environment: ${this.options.environment}`);
      console.log(`Parallel: ${this.options.parallel}`);
      console.log(`Quality Gates: ${this.options.qualityGates}`);
      console.log('─'.repeat(50));

      // Register all test suites
      await this.registerTestSuites();

      // Health check
      const isHealthy = await this.framework.healthCheck();
      if (!isHealthy) {
        throw new Error('Testing framework health check failed');
      }

      // Run tests based on options
      let results;
      if (this.options.suites) {
        // Run specific suites
        results = new Map();
        for (const suiteId of this.options.suites) {
          const suiteResults = await this.framework.runBy({ 
            tags: [suiteId] 
          });
          suiteResults.forEach((result, id) => results.set(id, result));
        }
      } else if (this.options.priority) {
        // Run by priority
        results = await this.framework.runBy({ 
          priority: this.options.priority 
        });
      } else if (this.options.tags) {
        // Run by tags
        results = await this.framework.runBy({ 
          tags: this.options.tags 
        });
      } else {
        // Run all tests
        results = await this.framework.runAll();
      }

      // Display results
      await this.displayResults(results);

      // Check quality gates
      const qualityGateStatus = await this.framework.getQualityGateStatus();
      await this.displayQualityGateStatus(qualityGateStatus);

      // Display final statistics
      const stats = this.framework.getStatistics();
      this.displayStatistics(stats);

      // Exit with appropriate code
      if (qualityGateStatus?.status === 'failed') {
        console.log('❌ Quality gates failed - exiting with code 1');
        process.exit(1);
      } else if (stats.failed > 0) {
        console.log('❌ Some tests failed - exiting with code 1');
        process.exit(1);
      } else {
        console.log('✅ All tests passed successfully');
        process.exit(0);
      }

    } catch (error) {
      console.error('💥 Test execution failed:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  private async registerTestSuites(): Promise<void> {
    console.log('📝 Registering test suites...');

    // Unit Tests
    this.framework.registerSuite({
      id: 'unit-tests',
      name: 'Unit Tests',
      type: 'unit',
      priority: 'high',
      tags: ['unit', 'fast'],
      dependencies: [],
      environment: 'local',
      timeout: 300000, // 5 minutes
      retries: 1,
      parallel: true,
      config: {
        testPattern: 'src/**/__tests__/**/*.{test,spec}.{js,ts,tsx}',
        coverage: this.options.coverage,
        maxWorkers: this.options.parallel ? 4 : 1
      }
    });

    // Integration Tests
    this.framework.registerSuite({
      id: 'integration-tests',
      name: 'Integration Tests',
      type: 'integration',
      priority: 'high',
      tags: ['integration', 'api'],
      dependencies: ['unit-tests'],
      environment: 'test',
      timeout: 600000, // 10 minutes
      retries: 2,
      parallel: false,
      config: {
        services: [
          {
            name: 'next-portal',
            baseUrl: 'http://localhost:4400',
            healthEndpoint: '/api/health',
            dependencies: []
          }
        ],
        databases: [
          {
            name: 'test-db',
            type: 'postgres',
            connectionString: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb',
            testQueries: ['SELECT 1', 'SELECT version()']
          }
        ]
      }
    });

    // Contract Tests (if API specifications exist)
    if (existsSync(resolve(process.cwd(), 'api-spec.yaml'))) {
      this.framework.registerSuite({
        id: 'contract-tests',
        name: 'API Contract Tests',
        type: 'contract',
        priority: 'high',
        tags: ['contract', 'api'],
        dependencies: ['unit-tests'],
        environment: 'test',
        timeout: 300000,
        retries: 2,
        parallel: false,
        config: {
          contract: {
            provider: 'next-portal-api',
            consumer: 'frontend-client',
            providerBaseUrl: 'http://localhost:4400/api',
            specification: './api-spec.yaml',
            compatibilityMode: 'strict'
          }
        }
      });
    }

    // E2E Tests (if Playwright tests exist)
    if (existsSync(resolve(process.cwd(), 'tests/e2e'))) {
      this.framework.registerSuite({
        id: 'e2e-tests',
        name: 'End-to-End Tests',
        type: 'e2e',
        priority: 'medium',
        tags: ['e2e', 'browser'],
        dependencies: ['integration-tests'],
        environment: 'e2e',
        timeout: 1200000, // 20 minutes
        retries: 2,
        parallel: false,
        config: {
          testPattern: 'tests/e2e/**/*.spec.ts',
          headed: false,
          workers: 1
        }
      });
    }

    // Performance Tests (if K6 scripts exist)
    if (existsSync(resolve(process.cwd(), 'tests/performance'))) {
      this.framework.registerSuite({
        id: 'performance-tests',
        name: 'Performance Tests',
        type: 'performance',
        priority: 'medium',
        tags: ['performance', 'load'],
        dependencies: ['integration-tests'],
        environment: 'performance',
        timeout: 900000, // 15 minutes
        retries: 1,
        parallel: false,
        config: {
          baseUrl: 'http://localhost:4400',
          scenarios: [
            {
              name: 'homepage-load',
              type: 'load',
              target: '/',
              duration: '2m',
              vus: 10,
              requests: [
                {
                  name: 'homepage',
                  method: 'GET',
                  url: '/',
                  weight: 1
                }
              ],
              thresholds: {
                'http_req_duration': 'p(95)<3000',
                'http_req_failed': 'rate<0.10'
              }
            }
          ]
        }
      });
    }

    // Security Tests (development and staging only)
    if (this.options.environment !== 'production') {
      this.framework.registerSuite({
        id: 'security-tests',
        name: 'Security Vulnerability Tests',
        type: 'security',
        priority: 'critical',
        tags: ['security', 'vulnerability'],
        dependencies: ['integration-tests'],
        environment: 'security',
        timeout: 1800000, // 30 minutes
        retries: 1,
        parallel: false,
        config: {
          target: 'http://localhost:4400',
          scanTypes: [
            { type: 'secrets-scan', enabled: true },
            { type: 'ssl-scan', enabled: true }
          ]
        }
      });
    }

    console.log(`✅ Registered ${this.framework['suites'].size} test suites`);
  }

  private setupEventHandlers(): void {
    this.framework.on('framework:started', () => {
      console.log('🏁 Test execution started');
    });

    this.framework.on('suite:started', (suite) => {
      console.log(`🔄 Running: ${suite.name} (${suite.type})`);
    });

    this.framework.on('suite:completed', (suite, result) => {
      const icon = result.status === 'passed' ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      console.log(`${icon} ${suite.name}: ${result.status} (${duration}s)`);
      
      if (result.errors && result.errors.length > 0 && this.options.verbose) {
        result.errors.forEach(error => {
          console.log(`   ⚠️  ${error.message}`);
        });
      }
    });

    this.framework.on('quality-gate:failed', (gate) => {
      console.log(`🚫 Quality gate failed: ${gate.name}`);
    });

    this.framework.on('quality-gate:passed', (gate) => {
      if (this.options.verbose) {
        console.log(`✅ Quality gate passed: ${gate.name}`);
      }
    });

    this.framework.on('framework:error', (error) => {
      console.error('💥 Framework error:', error.message);
    });
  }

  private async displayResults(results: Map<string, any>): Promise<void> {
    console.log('\n📊 Test Results Summary');
    console.log('─'.repeat(50));
    
    const resultsArray = Array.from(results.values());
    const passed = resultsArray.filter(r => r.status === 'passed').length;
    const failed = resultsArray.filter(r => r.status === 'failed').length;
    const errors = resultsArray.filter(r => r.status === 'error').length;
    const skipped = resultsArray.filter(r => r.status === 'skipped').length;
    
    console.log(`Total Tests: ${resultsArray.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`💥 Errors: ${errors}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    
    if (resultsArray.length > 0) {
      const passRate = (passed / resultsArray.length) * 100;
      console.log(`📈 Pass Rate: ${passRate.toFixed(1)}%`);
    }

    // Display coverage if available
    const coverageResults = resultsArray.filter(r => r.coverage);
    if (coverageResults.length > 0 && this.options.coverage) {
      console.log('\n📋 Code Coverage Summary');
      console.log('─'.repeat(30));
      
      const avgLineCoverage = coverageResults.reduce((sum, r) => 
        sum + (r.coverage.lines?.percentage || 0), 0) / coverageResults.length;
      const avgFunctionCoverage = coverageResults.reduce((sum, r) => 
        sum + (r.coverage.functions?.percentage || 0), 0) / coverageResults.length;
      
      console.log(`Lines: ${avgLineCoverage.toFixed(1)}%`);
      console.log(`Functions: ${avgFunctionCoverage.toFixed(1)}%`);
    }
  }

  private async displayQualityGateStatus(status: any): Promise<void> {
    if (!status) return;

    console.log('\n🚪 Quality Gates Status');
    console.log('─'.repeat(30));
    
    const statusIcon = status.status === 'passed' ? '✅' : '❌';
    console.log(`Overall Status: ${statusIcon} ${status.status.toUpperCase()}`);
    
    if (status.results && status.results.length > 0) {
      console.log(`Passed: ${status.passed}/${status.total}`);
      console.log(`Failed: ${status.failed}/${status.total}`);
      
      if (status.failed > 0) {
        console.log('\nFailed Gates:');
        status.results
          .filter((r: any) => r.status === 'failed')
          .forEach((result: any) => {
            console.log(`  ❌ ${result.gate.name}: ${result.actualValue} (expected ${result.expectedValue})`);
          });
      }
    }

    if (status.recommendations && status.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      status.recommendations.forEach((rec: string) => {
        console.log(`  • ${rec}`);
      });
    }
  }

  private displayStatistics(stats: any): void {
    console.log('\n📈 Execution Statistics');
    console.log('─'.repeat(30));
    console.log(`Total Duration: ${(stats.totalDuration / 1000).toFixed(1)}s`);
    console.log(`Average Duration: ${(stats.averageDuration / 1000).toFixed(1)}s`);
    console.log(`Pass Rate: ${stats.passRate.toFixed(1)}%`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: TestRunnerOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--environment':
      case '-e':
        options.environment = nextArg as any;
        i++;
        break;
      case '--priority':
      case '-p':
        options.priority = nextArg as any;
        i++;
        break;
      case '--suites':
      case '-s':
        options.suites = nextArg?.split(',');
        i++;
        break;
      case '--tags':
      case '-t':
        options.tags = nextArg?.split(',');
        i++;
        break;
      case '--fail-fast':
        options.failFast = true;
        break;
      case '--no-parallel':
        options.parallel = false;
        break;
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--no-reporting':
        options.reporting = false;
        break;
      case '--no-quality-gates':
        options.qualityGates = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  const runner = new ComprehensiveTestRunner(options);
  await runner.run();
}

function printHelp() {
  console.log(`
🧪 Comprehensive Test Runner

Usage: npm run test:comprehensive [options]

Options:
  -e, --environment <env>    Test environment (development|staging|production)
  -p, --priority <priority>  Run tests by priority (critical|high|medium|low)
  -s, --suites <suites>      Run specific suites (comma-separated)
  -t, --tags <tags>          Run tests with specific tags (comma-separated)
  --fail-fast               Stop on first failure
  --no-parallel            Disable parallel execution
  --no-coverage            Skip code coverage
  --no-reporting           Skip report generation
  --no-quality-gates       Skip quality gate evaluation
  -v, --verbose            Verbose output
  -h, --help               Show this help

Examples:
  npm run test:comprehensive
  npm run test:comprehensive -- --environment staging --priority critical
  npm run test:comprehensive -- --suites unit-tests,integration-tests
  npm run test:comprehensive -- --tags security,performance --verbose
  `);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to run tests:', error.message);
    process.exit(1);
  });
}