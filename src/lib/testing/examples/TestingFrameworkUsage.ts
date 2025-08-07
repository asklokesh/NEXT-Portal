/**
 * Testing Framework Usage Examples
 * Comprehensive examples of how to use the advanced testing framework
 */

import TestingFramework, { TestSuite } from '../TestingFramework';
import { getTestingConfig, createTestingConfig } from '../config/TestingFrameworkConfig';

/**
 * Example 1: Basic Testing Framework Setup
 */
export async function basicTestingExample() {
  // Get configuration for current environment
  const config = getTestingConfig(process.env.NODE_ENV as any);
  
  // Initialize the testing framework
  const testingFramework = new TestingFramework(config);
  
  // Register event listeners
  testingFramework.on('framework:started', () => {
    console.log('Testing framework started');
  });
  
  testingFramework.on('suite:completed', (suite, result) => {
    console.log(`Test suite ${suite.id} completed with status: ${result.status}`);
  });
  
  testingFramework.on('quality-gate:failed', (gate) => {
    console.warn(`Quality gate failed: ${gate.name}`);
  });
  
  // Register test suites
  const unitTestSuite: TestSuite = {
    id: 'unit-tests',
    name: 'Unit Tests',
    type: 'unit',
    priority: 'high',
    tags: ['unit', 'fast'],
    dependencies: [],
    environment: 'local',
    timeout: 120000,
    retries: 2,
    parallel: true,
    config: {
      testPattern: 'src/**/*.test.ts',
      coverage: true
    }
  };
  
  testingFramework.registerSuite(unitTestSuite);
  
  // Run all tests
  const results = await testingFramework.runAll();
  
  // Get quality gate status
  const qualityGateStatus = await testingFramework.getQualityGateStatus();
  
  console.log('Test Results:', results.size);
  console.log('Quality Gates:', qualityGateStatus?.status);
}

/**
 * Example 2: Comprehensive Test Suite Registration
 */
export async function comprehensiveTestingExample() {
  const config = createTestingConfig({
    framework: {
      parallel: true,
      maxConcurrency: 6,
      timeout: 600000
    },
    qualityGates: {
      strictMode: true
    }
  });
  
  const framework = new TestingFramework(config);
  
  // Unit Tests
  framework.registerSuite({
    id: 'unit-plugin-tests',
    name: 'Plugin Unit Tests',
    type: 'unit',
    priority: 'critical',
    tags: ['unit', 'plugins'],
    dependencies: [],
    environment: 'local',
    timeout: 180000,
    retries: 1,
    parallel: true,
    config: {
      testPattern: 'src/lib/plugins/**/*.test.ts',
      coverage: true,
      maxWorkers: 4
    }
  });
  
  // Contract Tests
  framework.registerSuite({
    id: 'api-contract-tests',
    name: 'API Contract Tests',
    type: 'contract',
    priority: 'high',
    tags: ['contract', 'api'],
    dependencies: ['unit-plugin-tests'],
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
  
  // Integration Tests
  framework.registerSuite({
    id: 'service-integration-tests',
    name: 'Service Integration Tests',
    type: 'integration',
    priority: 'high',
    tags: ['integration', 'services'],
    dependencies: ['api-contract-tests'],
    environment: 'integration',
    timeout: 600000,
    retries: 3,
    parallel: true,
    config: {
      services: [
        {
          name: 'next-portal',
          baseUrl: 'http://localhost:4400',
          healthEndpoint: '/api/health',
          dependencies: ['postgres', 'redis']
        },
        {
          name: 'backstage',
          baseUrl: 'http://localhost:7007',
          healthEndpoint: '/api/catalog/health',
          dependencies: []
        }
      ],
      databases: [
        {
          name: 'postgres',
          type: 'postgres',
          connectionString: 'postgresql://test:test@localhost:5432/testdb',
          testQueries: ['SELECT 1', 'SELECT COUNT(*) FROM plugins']
        }
      ],
      messageQueues: [
        {
          name: 'redis',
          type: 'redis',
          brokers: ['localhost:6379']
        }
      ]
    }
  });
  
  // Performance Tests
  framework.registerSuite({
    id: 'load-performance-tests',
    name: 'Load Performance Tests',
    type: 'performance',
    priority: 'medium',
    tags: ['performance', 'load'],
    dependencies: ['service-integration-tests'],
    environment: 'performance',
    timeout: 900000,
    retries: 1,
    parallel: false,
    config: {
      baseUrl: 'http://localhost:4400',
      scenarios: [
        {
          name: 'homepage-load',
          type: 'load',
          target: '/',
          duration: '5m',
          vus: 50,
          requests: [
            {
              name: 'homepage',
              method: 'GET',
              url: '/',
              weight: 0.7
            },
            {
              name: 'api-plugins',
              method: 'GET',
              url: '/api/plugins',
              weight: 0.3
            }
          ],
          thresholds: {
            'http_req_duration': 'p(95)<2000',
            'http_req_failed': 'rate<0.05'
          }
        }
      ]
    }
  });
  
  // Security Tests
  framework.registerSuite({
    id: 'security-scan-tests',
    name: 'Security Vulnerability Scans',
    type: 'security',
    priority: 'critical',
    tags: ['security', 'vulnerability'],
    dependencies: ['service-integration-tests'],
    environment: 'security',
    timeout: 1800000, // 30 minutes
    retries: 1,
    parallel: false,
    config: {
      target: 'http://localhost:4400',
      scanTypes: [
        { type: 'owasp-zap', enabled: true },
        { type: 'nuclei', enabled: true },
        { type: 'ssl-scan', enabled: true },
        { type: 'secrets-scan', enabled: true }
      ],
      excludeUrls: [
        '/api/internal/*',
        '/health'
      ]
    }
  });
  
  // E2E Tests
  framework.registerSuite({
    id: 'critical-user-journeys',
    name: 'Critical User Journey E2E Tests',
    type: 'e2e',
    priority: 'critical',
    tags: ['e2e', 'user-journey'],
    dependencies: ['service-integration-tests'],
    environment: 'e2e',
    timeout: 1200000, // 20 minutes
    retries: 2,
    parallel: false,
    config: {
      testPattern: 'tests/e2e/critical-paths/**/*.spec.ts',
      headed: false,
      workers: 2
    }
  });
  
  // Chaos Engineering Tests
  framework.registerSuite({
    id: 'resilience-chaos-tests',
    name: 'Resilience Chaos Engineering Tests',
    type: 'chaos',
    priority: 'low',
    tags: ['chaos', 'resilience'],
    dependencies: ['critical-user-journeys'],
    environment: 'chaos',
    timeout: 1800000, // 30 minutes
    retries: 1,
    parallel: false,
    config: {
      experiments: [
        {
          name: 'network-latency-injection',
          type: 'network',
          description: 'Inject network latency to test resilience',
          method: {
            type: 'latency',
            parameters: { delay: '200ms', jitter: '50ms' }
          },
          target: {
            type: 'service',
            selector: { app: 'next-portal' }
          },
          duration: '5m',
          magnitude: 70
        }
      ],
      steadyStateHypothesis: {
        title: 'Application remains responsive under network stress',
        probes: [
          {
            name: 'response-time-check',
            type: 'http',
            tolerance: { type: 'range', value: { min: 0, max: 5000 } },
            provider: {
              type: 'http',
              config: { url: 'http://localhost:4400/api/health' }
            }
          }
        ]
      }
    }
  });
  
  // Run tests with filtering
  console.log('Running critical tests...');
  const criticalResults = await framework.runBy({ priority: 'critical' });
  
  console.log('Running all tests...');
  const allResults = await framework.runAll();
  
  // Get comprehensive statistics
  const stats = framework.getStatistics();
  console.log('Final Statistics:', stats);
  
  return { criticalResults, allResults, stats };
}

/**
 * Example 3: Custom Quality Gates
 */
export async function customQualityGatesExample() {
  const framework = new TestingFramework(getTestingConfig());
  
  // Register custom quality gates
  framework.qualityGateEngine.registerGate({
    id: 'custom-api-performance',
    name: 'API Performance Gate',
    type: 'performance',
    condition: {
      metric: 'performance.response_time_avg',
      operator: 'lte',
      value: 1500, // 1.5 seconds
      aggregation: 'avg'
    },
    severity: 'critical',
    enabled: true,
    description: 'Ensures API responses are within acceptable performance limits'
  });
  
  framework.qualityGateEngine.registerGate({
    id: 'plugin-coverage',
    name: 'Plugin Code Coverage',
    type: 'coverage',
    condition: {
      metric: 'coverage.lines',
      operator: 'gte',
      value: 95,
      aggregation: 'avg'
    },
    severity: 'major',
    enabled: true,
    description: 'Ensures plugin code has high test coverage'
  });
  
  // Register test suite
  framework.registerSuite({
    id: 'plugin-quality-tests',
    name: 'Plugin Quality Tests',
    type: 'unit',
    priority: 'high',
    tags: ['plugins', 'quality'],
    dependencies: [],
    environment: 'local',
    timeout: 300000,
    retries: 1,
    parallel: true,
    config: {
      testPattern: 'src/lib/plugins/**/*.test.ts',
      coverage: true
    }
  });
  
  const results = await framework.runAll();
  const qualityGateStatus = await framework.getQualityGateStatus();
  
  return { results, qualityGateStatus };
}

/**
 * Example 4: Event-Driven Testing with Webhooks
 */
export async function eventDrivenTestingExample() {
  const config = createTestingConfig({
    reporting: {
      enabled: true,
      formats: ['html', 'json', 'junit'],
      realtime: true,
      webhooks: [
        {
          url: 'https://hooks.slack.com/webhook/test',
          events: ['framework:completed', 'quality-gate:failed'],
          headers: {
            'Content-Type': 'application/json'
          }
        },
        {
          url: 'http://localhost:3001/test-results',
          events: ['framework:completed'],
          authentication: {
            type: 'bearer',
            credentials: { token: 'test-token' }
          }
        }
      ]
    }
  });
  
  const framework = new TestingFramework(config);
  
  // Comprehensive event handling
  framework.on('framework:started', (data) => {
    console.log('Testing started:', data);
  });
  
  framework.on('suite:started', (suite) => {
    console.log(`Starting test suite: ${suite.name}`);
  });
  
  framework.on('suite:completed', (suite, result) => {
    console.log(`Completed: ${suite.name} - ${result.status} (${result.duration}ms)`);
  });
  
  framework.on('quality-gate:failed', (gate) => {
    console.error(`QUALITY GATE FAILED: ${gate.name}`);
    // Could trigger additional actions like stopping deployment
  });
  
  framework.on('framework:completed', (data) => {
    console.log('Testing completed:', {
      totalSuites: data.results.size,
      qualityGateStatus: data.qualityGateResult.status,
      recommendations: data.summary.recommendations
    });
  });
  
  // Register minimal test suite for demonstration
  framework.registerSuite({
    id: 'webhook-demo-test',
    name: 'Webhook Demonstration Test',
    type: 'unit',
    priority: 'medium',
    tags: ['demo'],
    dependencies: [],
    environment: 'local',
    timeout: 60000,
    retries: 1,
    parallel: true,
    config: {}
  });
  
  return await framework.runAll();
}

/**
 * Example 5: Production Monitoring Integration
 */
export async function productionMonitoringExample() {
  const config = createTestingConfig({
    integrations: {
      ci: true,
      monitoring: true,
      alerting: true
    },
    reporting: {
      enabled: true,
      formats: ['json', 'dashboard'],
      realtime: true,
      webhooks: [
        {
          url: 'http://prometheus:9090/api/v1/write',
          events: ['framework:completed'],
          headers: {
            'Content-Type': 'application/x-protobuf'
          }
        }
      ]
    }
  });
  
  const framework = new TestingFramework(config);
  
  // Production readiness test suite
  framework.registerSuite({
    id: 'production-readiness-tests',
    name: 'Production Readiness Validation',
    type: 'integration',
    priority: 'critical',
    tags: ['production', 'readiness'],
    dependencies: [],
    environment: 'production-like',
    timeout: 1800000,
    retries: 3,
    parallel: false,
    config: {
      services: [
        {
          name: 'next-portal-production',
          baseUrl: 'https://portal.company.com',
          healthEndpoint: '/api/health',
          dependencies: ['database', 'redis', 'auth-service']
        }
      ],
      externalAPIs: [
        {
          name: 'auth0',
          baseUrl: 'https://company.auth0.com',
          endpoints: [
            {
              path: '/userinfo',
              method: 'GET',
              expectedStatus: 401 // Should require auth
            }
          ]
        }
      ]
    }
  });
  
  const results = await framework.runAll();
  
  // Generate production readiness report
  const dashboard = framework.reportingEngine.getDashboardData();
  
  return { results, dashboard };
}

/**
 * Example 6: CI/CD Pipeline Integration
 */
export async function cicdIntegrationExample() {
  // Configuration for different CI/CD stages
  const configs = {
    pullRequest: createTestingConfig({
      framework: { maxConcurrency: 2, timeout: 300000, failFast: true },
      qualityGates: { strictMode: false }
    }),
    staging: createTestingConfig({
      framework: { maxConcurrency: 4, timeout: 600000, failFast: false },
      qualityGates: { strictMode: true }
    }),
    production: createTestingConfig({
      framework: { maxConcurrency: 8, timeout: 900000, failFast: true },
      qualityGates: { strictMode: true, thresholds: { coverage: { lines: 95, functions: 95, branches: 90, statements: 95 } } }
    })
  };
  
  const stage = process.env.CI_STAGE || 'pullRequest';
  const framework = new TestingFramework(configs[stage as keyof typeof configs]);
  
  // Stage-specific test registration
  if (stage === 'pullRequest') {
    framework.registerSuite({
      id: 'pr-validation-tests',
      name: 'Pull Request Validation',
      type: 'unit',
      priority: 'high',
      tags: ['pr', 'validation'],
      dependencies: [],
      environment: 'ci',
      timeout: 180000,
      retries: 1,
      parallel: true,
      config: { testPattern: '**/*.test.ts', coverage: true }
    });
  }
  
  if (['staging', 'production'].includes(stage)) {
    framework.registerSuite({
      id: 'deployment-validation-tests',
      name: 'Deployment Validation',
      type: 'e2e',
      priority: 'critical',
      tags: ['deployment', 'validation'],
      dependencies: [],
      environment: stage,
      timeout: 900000,
      retries: 2,
      parallel: false,
      config: { testPattern: 'tests/e2e/deployment/**/*.spec.ts' }
    });
  }
  
  const results = await framework.runAll();
  const qualityGateStatus = await framework.getQualityGateStatus();
  
  // Exit with appropriate code for CI/CD
  if (qualityGateStatus?.status === 'failed') {
    process.exit(1);
  }
  
  return results;
}

// Export all examples for easy usage
export const testingExamples = {
  basic: basicTestingExample,
  comprehensive: comprehensiveTestingExample,
  customQualityGates: customQualityGatesExample,
  eventDriven: eventDrivenTestingExample,
  productionMonitoring: productionMonitoringExample,
  cicdIntegration: cicdIntegrationExample
};