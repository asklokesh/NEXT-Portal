/**
 * Plugin Testing Framework
 * Comprehensive testing environment for Backstage plugins
 * Provides mock environments, automated test suites, and validation testing
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import axios, { AxiosInstance } from 'axios';
import { pluginValidator, PluginValidationResult } from '../plugins/PluginValidator';
import { pluginInstaller, PluginInstallationResult } from '../plugins/plugin-installer';

export interface TestEnvironment {
  id: string;
  name: string;
  backstageVersion: string;
  nodeVersion: string;
  port: number;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';
  createdAt: Date;
  lastUsed: Date;
  plugins: string[];
}

export interface TestSuite {
  id: string;
  name: string;
  pluginId: string;
  tests: TestCase[];
  environment: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: TestResults;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  timeout: number;
  setup?: () => Promise<void>;
  test: () => Promise<TestResult>;
  teardown?: () => Promise<void>;
}

export interface TestResult {
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
  screenshots?: string[];
  logs?: string[];
}

export interface TestResults {
  suiteId: string;
  pluginId: string;
  environment: string;
  startTime: Date;
  endTime: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage?: TestCoverage;
  results: Array<{
    testId: string;
    testName: string;
    result: TestResult;
  }>;
}

export interface TestCoverage {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface MockBackstageConfig {
  version: string;
  plugins: string[];
  integrations: {
    github?: boolean;
    gitlab?: boolean;
    kubernetes?: boolean;
  };
  authentication: {
    providers: string[];
  };
  catalog: {
    rules: any[];
    locations: string[];
  };
}

export class PluginTester extends EventEmitter {
  private testEnvironments: Map<string, TestEnvironment> = new Map();
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private testSuites: Map<string, TestSuite> = new Map();
  private mockServerPort = 8000;
  private workingDir: string;

  constructor(workingDir: string = './test-environments') {
    super();
    this.workingDir = path.resolve(workingDir);
    this.initializeTestingFramework();
  }

  /**
   * Initialize the testing framework
   */
  private async initializeTestingFramework(): Promise<void> {
    try {
      // Ensure working directory exists
      await fs.mkdir(this.workingDir, { recursive: true });
      
      // Load existing test environments
      await this.loadTestEnvironments();
      
      console.log('Plugin testing framework initialized');
    } catch (error) {
      console.error('Failed to initialize testing framework:', error);
    }
  }

  /**
   * Create a new test environment
   */
  async createTestEnvironment(config: {
    name: string;
    backstageVersion: string;
    nodeVersion?: string;
    plugins?: string[];
  }): Promise<TestEnvironment> {
    const environment: TestEnvironment = {
      id: this.generateId(),
      name: config.name,
      backstageVersion: config.backstageVersion,
      nodeVersion: config.nodeVersion || process.version,
      port: await this.findAvailablePort(),
      status: 'stopped',
      createdAt: new Date(),
      lastUsed: new Date(),
      plugins: config.plugins || []
    };

    // Create environment directory
    const envDir = path.join(this.workingDir, environment.id);
    await fs.mkdir(envDir, { recursive: true });

    // Create mock Backstage instance
    await this.createMockBackstageInstance(environment);

    this.testEnvironments.set(environment.id, environment);
    await this.saveTestEnvironments();

    this.emit('environmentCreated', environment);
    return environment;
  }

  /**
   * Start a test environment
   */
  async startTestEnvironment(environmentId: string): Promise<void> {
    const environment = this.testEnvironments.get(environmentId);
    if (!environment) {
      throw new Error(`Test environment ${environmentId} not found`);
    }

    if (environment.status === 'running') {
      return; // Already running
    }

    try {
      environment.status = 'starting';
      this.emit('environmentStatusChanged', environment);

      const envDir = path.join(this.workingDir, environmentId);
      
      // Start the mock Backstage instance
      const child = spawn('npm', ['start'], {
        cwd: envDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PORT: environment.port.toString(),
          NODE_ENV: 'test'
        }
      });

      this.runningProcesses.set(environmentId, child);

      // Wait for the server to be ready
      await this.waitForServer(`http://localhost:${environment.port}`, 60000);

      environment.status = 'running';
      environment.lastUsed = new Date();
      
      this.emit('environmentStatusChanged', environment);
      console.log(`Test environment ${environmentId} started on port ${environment.port}`);
    } catch (error) {
      environment.status = 'failed';
      this.emit('environmentStatusChanged', environment);
      throw error;
    }
  }

  /**
   * Stop a test environment
   */
  async stopTestEnvironment(environmentId: string): Promise<void> {
    const environment = this.testEnvironments.get(environmentId);
    if (!environment) {
      throw new Error(`Test environment ${environmentId} not found`);
    }

    const child = this.runningProcesses.get(environmentId);
    if (child) {
      environment.status = 'stopping';
      this.emit('environmentStatusChanged', environment);

      child.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        child.on('exit', () => {
          this.runningProcesses.delete(environmentId);
          resolve();
        });
        
        // Force kill after 10 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
          resolve();
        }, 10000);
      });
    }

    environment.status = 'stopped';
    this.emit('environmentStatusChanged', environment);
    console.log(`Test environment ${environmentId} stopped`);
  }

  /**
   * Create a test suite for a plugin
   */
  async createTestSuite(config: {
    name: string;
    pluginId: string;
    environment: string;
    tests?: TestCase[];
  }): Promise<TestSuite> {
    const testSuite: TestSuite = {
      id: this.generateId(),
      name: config.name,
      pluginId: config.pluginId,
      environment: config.environment,
      status: 'pending',
      tests: config.tests || []
    };

    // Add default test cases if none provided
    if (testSuite.tests.length === 0) {
      testSuite.tests = await this.createDefaultTestCases(config.pluginId);
    }

    this.testSuites.set(testSuite.id, testSuite);
    this.emit('testSuiteCreated', testSuite);
    
    return testSuite;
  }

  /**
   * Run a test suite
   */
  async runTestSuite(suiteId: string): Promise<TestResults> {
    const testSuite = this.testSuites.get(suiteId);
    if (!testSuite) {
      throw new Error(`Test suite ${suiteId} not found`);
    }

    const environment = this.testEnvironments.get(testSuite.environment);
    if (!environment) {
      throw new Error(`Test environment ${testSuite.environment} not found`);
    }

    // Ensure environment is running
    if (environment.status !== 'running') {
      await this.startTestEnvironment(testSuite.environment);
    }

    testSuite.status = 'running';
    this.emit('testSuiteStatusChanged', testSuite);

    const results: TestResults = {
      suiteId,
      pluginId: testSuite.pluginId,
      environment: testSuite.environment,
      startTime: new Date(),
      endTime: new Date(),
      totalTests: testSuite.tests.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      results: []
    };

    try {
      // Run each test case
      for (const testCase of testSuite.tests) {
        this.emit('testCaseStarted', { suiteId, testCase });
        
        try {
          // Setup
          if (testCase.setup) {
            await testCase.setup();
          }

          // Run test with timeout
          const result = await Promise.race([
            testCase.test(),
            new Promise<TestResult>((_, reject) => 
              setTimeout(() => reject(new Error('Test timeout')), testCase.timeout)
            )
          ]);

          if (result.passed) {
            results.passedTests++;
          } else {
            results.failedTests++;
          }

          results.results.push({
            testId: testCase.id,
            testName: testCase.name,
            result
          });

          this.emit('testCaseCompleted', { suiteId, testCase, result });

        } catch (error) {
          results.failedTests++;
          const failedResult: TestResult = {
            passed: false,
            duration: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };

          results.results.push({
            testId: testCase.id,
            testName: testCase.name,
            result: failedResult
          });

          this.emit('testCaseCompleted', { suiteId, testCase, result: failedResult });
        } finally {
          // Teardown
          if (testCase.teardown) {
            try {
              await testCase.teardown();
            } catch (error) {
              console.warn('Test teardown failed:', error);
            }
          }
        }
      }

      results.endTime = new Date();
      testSuite.status = 'completed';
      testSuite.results = results;

    } catch (error) {
      testSuite.status = 'failed';
      results.endTime = new Date();
      
      console.error('Test suite execution failed:', error);
      this.emit('testSuiteFailed', { testSuite, error });
    }

    this.emit('testSuiteCompleted', { testSuite, results });
    return results;
  }

  /**
   * Validate plugin in test environment
   */
  async validatePluginInEnvironment(
    pluginId: string, 
    environmentId: string,
    config?: any
  ): Promise<PluginValidationResult> {
    const environment = this.testEnvironments.get(environmentId);
    if (!environment) {
      throw new Error(`Test environment ${environmentId} not found`);
    }

    // Ensure environment is running
    if (environment.status !== 'running') {
      await this.startTestEnvironment(environmentId);
    }

    // Install plugin in test environment if not already installed
    if (!environment.plugins.includes(pluginId)) {
      await this.installPluginInEnvironment(pluginId, environmentId, config);
    }

    // Create API client for the test environment
    const apiClient = axios.create({
      baseURL: `http://localhost:${environment.port}`,
      timeout: 10000
    });

    // Run validation with test environment context
    const validation = await pluginValidator.validatePlugin(pluginId, config);
    
    // Add environment-specific checks
    try {
      // Check if plugin is accessible
      const response = await apiClient.get(`/api/plugins/${pluginId}/health`);
      validation.runtime.isHealthy = response.status === 200;
      
      // Update performance metrics from test environment
      const metricsResponse = await apiClient.get(`/api/plugins/${pluginId}/metrics`);
      if (metricsResponse.data) {
        validation.runtime.performance = {
          ...validation.runtime.performance,
          ...metricsResponse.data
        };
      }
      
    } catch (error) {
      validation.errors.push({
        code: 'ENVIRONMENT_TEST_FAILED',
        message: `Plugin failed to respond in test environment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'major'
      });
    }

    return validation;
  }

  /**
   * Install plugin in test environment
   */
  async installPluginInEnvironment(
    pluginId: string,
    environmentId: string,
    config?: any
  ): Promise<PluginInstallationResult> {
    const environment = this.testEnvironments.get(environmentId);
    if (!environment) {
      throw new Error(`Test environment ${environmentId} not found`);
    }

    try {
      const envDir = path.join(this.workingDir, environmentId);
      
      // Install plugin using the plugin installer in the test environment
      const installer = new (await import('../plugins/plugin-installer')).PluginInstaller(envDir);
      const result = await installer.installPlugin(pluginId);

      if (result.success) {
        environment.plugins.push(pluginId);
        await this.saveTestEnvironments();
        
        // Restart environment to load the new plugin
        if (environment.status === 'running') {
          await this.stopTestEnvironment(environmentId);
          await this.startTestEnvironment(environmentId);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to install plugin in test environment',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create default test cases for a plugin
   */
  private async createDefaultTestCases(pluginId: string): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    // Basic health check test
    testCases.push({
      id: this.generateId(),
      name: 'Plugin Health Check',
      description: 'Verify that the plugin responds to health checks',
      type: 'integration',
      timeout: 10000,
      test: async (): Promise<TestResult> => {
        const startTime = Date.now();
        try {
          const response = await axios.get(`http://localhost:${this.mockServerPort}/api/plugins/${pluginId}/health`);
          return {
            passed: response.status === 200,
            duration: Date.now() - startTime,
            details: { status: response.status, data: response.data }
          };
        } catch (error) {
          return {
            passed: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Configuration validation test
    testCases.push({
      id: this.generateId(),
      name: 'Configuration Validation',
      description: 'Validate plugin configuration schema',
      type: 'unit',
      timeout: 5000,
      test: async (): Promise<TestResult> => {
        const startTime = Date.now();
        try {
          const validation = await pluginValidator.validatePlugin(pluginId);
          return {
            passed: validation.isValid,
            duration: Date.now() - startTime,
            details: {
              score: validation.score,
              errors: validation.errors,
              warnings: validation.warnings
            }
          };
        } catch (error) {
          return {
            passed: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Performance test
    testCases.push({
      id: this.generateId(),
      name: 'Performance Benchmark',
      description: 'Measure plugin response times under load',
      type: 'performance',
      timeout: 30000,
      test: async (): Promise<TestResult> => {
        const startTime = Date.now();
        const responseTimes: number[] = [];
        
        try {
          // Make 10 concurrent requests
          const promises = Array(10).fill(0).map(async () => {
            const requestStart = Date.now();
            await axios.get(`http://localhost:${this.mockServerPort}/api/plugins/${pluginId}`);
            return Date.now() - requestStart;
          });
          
          const times = await Promise.all(promises);
          responseTimes.push(...times);
          
          const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
          const maxResponseTime = Math.max(...responseTimes);
          
          return {
            passed: avgResponseTime < 1000 && maxResponseTime < 2000, // Performance thresholds
            duration: Date.now() - startTime,
            details: {
              averageResponseTime: avgResponseTime,
              maxResponseTime: maxResponseTime,
              allResponseTimes: responseTimes
            }
          };
        } catch (error) {
          return {
            passed: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    return testCases;
  }

  /**
   * Create mock Backstage instance
   */
  private async createMockBackstageInstance(environment: TestEnvironment): Promise<void> {
    const envDir = path.join(this.workingDir, environment.id);
    
    // Create package.json
    const packageJson = {
      name: `test-backstage-${environment.id}`,
      version: '1.0.0',
      private: true,
      scripts: {
        start: 'node server.js'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
        'body-parser': '^1.20.0'
      }
    };
    
    await fs.writeFile(
      path.join(envDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create mock server
    const serverCode = this.generateMockServerCode(environment);
    await fs.writeFile(path.join(envDir, 'server.js'), serverCode);

    // Create app-config.yaml
    const config: MockBackstageConfig = {
      version: environment.backstageVersion,
      plugins: environment.plugins,
      integrations: {},
      authentication: { providers: [] },
      catalog: { rules: [], locations: [] }
    };
    
    await fs.writeFile(
      path.join(envDir, 'app-config.yaml'),
      JSON.stringify(config, null, 2)
    );
  }

  /**
   * Generate mock server code
   */
  private generateMockServerCode(environment: TestEnvironment): string {
    return `
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = ${environment.port};

app.use(cors());
app.use(bodyParser.json());

// Mock system info
app.get('/api/system/info', (req, res) => {
  res.json({
    version: '${environment.backstageVersion}',
    buildInfo: {
      version: '${environment.backstageVersion}',
      timestamp: new Date().toISOString(),
      commit: 'test-mock'
    },
    plugins: {
      installed: ${JSON.stringify(environment.plugins)},
      enabled: ${JSON.stringify(environment.plugins)},
      disabled: []
    },
    configuration: {
      integrations: [],
      authentication: [],
      features: []
    },
    health: {
      status: 'healthy',
      components: {}
    }
  });
});

// Mock plugin health endpoints
app.get('/api/plugins/:pluginId/health', (req, res) => {
  const pluginId = req.params.pluginId;
  res.json({
    pluginId,
    status: 'healthy',
    lastCheck: new Date(),
    responseTime: Math.random() * 100 + 50,
    errors: [],
    warnings: [],
    metrics: {
      memoryUsage: Math.random() * 100,
      cpuUsage: Math.random() * 50,
      requestCount: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 0.05
    }
  });
});

// Mock plugin info
app.get('/api/plugins/:pluginId', (req, res) => {
  const pluginId = req.params.pluginId;
  res.json({
    name: pluginId,
    version: '1.0.0',
    description: \`Mock plugin \${pluginId}\`,
    author: 'Test Author',
    pluginType: 'frontend',
    installationStatus: 'installed',
    healthStatus: 'healthy',
    lastUpdated: new Date(),
    configuration: {},
    dependencies: [],
    peerDependencies: []
  });
});

// Mock system health
app.get('/api/system/health', (req, res) => {
  res.json({
    status: 'healthy',
    components: {
      api: { status: 'healthy' },
      database: { status: 'healthy' },
      cache: { status: 'healthy' }
    }
  });
});

app.listen(port, () => {
  console.log(\`Mock Backstage server running on port \${port}\`);
});
`;
  }

  /**
   * Utility methods
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async findAvailablePort(): Promise<number> {
    // Simple port finder - in production you'd use a proper port-finding library
    return Math.floor(Math.random() * 1000) + 8000;
  }

  private async waitForServer(url: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await axios.get(`${url}/api/system/health`);
        return; // Server is ready
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error(`Server at ${url} did not start within ${timeout}ms`);
  }

  private async loadTestEnvironments(): Promise<void> {
    try {
      const envFile = path.join(this.workingDir, 'environments.json');
      const data = await fs.readFile(envFile, 'utf-8');
      const environments = JSON.parse(data);
      
      for (const env of environments) {
        this.testEnvironments.set(env.id, env);
      }
    } catch (error) {
      // File doesn't exist or is invalid - start with empty state
    }
  }

  private async saveTestEnvironments(): Promise<void> {
    const envFile = path.join(this.workingDir, 'environments.json');
    const environments = Array.from(this.testEnvironments.values());
    await fs.writeFile(envFile, JSON.stringify(environments, null, 2));
  }

  /**
   * Cleanup all test environments
   */
  async cleanup(): Promise<void> {
    // Stop all running environments
    const runningEnvs = Array.from(this.testEnvironments.values())
      .filter(env => env.status === 'running');
    
    await Promise.all(
      runningEnvs.map(env => this.stopTestEnvironment(env.id))
    );

    // Clean up resources
    this.removeAllListeners();
  }
}

// Export singleton instance
export const pluginTester = new PluginTester();