import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestConfig {
  pluginId: string;
  testTypes: ('unit' | 'integration' | 'e2e' | 'performance' | 'security')[];
  dockerEnvironment?: string;
  config?: Record<string, any>;
  timeout?: number;
  coverage?: boolean;
  parallel?: boolean;
  environment?: 'local' | 'docker' | 'kubernetes';
}

interface TestResult {
  testId: string;
  pluginId: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  results: {
    unit?: TestExecution;
    integration?: TestExecution;
    e2e?: TestExecution;
    performance?: PerformanceTestResult;
    security?: SecurityTestResult;
  };
  coverage?: CoverageReport;
  logs: string[];
  artifacts: string[];
}

interface TestExecution {
  status: 'passed' | 'failed' | 'skipped';
  testCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  duration: number;
  failures: TestFailure[];
  stdout: string;
  stderr: string;
}

interface PerformanceTestResult {
  status: 'passed' | 'failed';
  metrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  thresholds: Record<string, boolean>;
  k6Output: string;
}

interface SecurityTestResult {
  status: 'passed' | 'failed';
  vulnerabilities: {
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: SecurityFinding[];
  tools: string[];
}

interface SecurityFinding {
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  cwe?: string;
  recommendation: string;
}

interface TestFailure {
  testName: string;
  error: string;
  stack?: string;
  file?: string;
  line?: number;
}

interface CoverageReport {
  statements: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  lines: { total: number; covered: number; percentage: number };
  files: CoverageFileReport[];
}

interface CoverageFileReport {
  filename: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

// Store for active test runs
const activeTests = new Map<string, { process: ChildProcess; result: TestResult }>();

export async function POST(request: NextRequest) {
  try {
    const config: TestConfig = await request.json();
    
    const testId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const testResult: TestResult = {
      testId,
      pluginId: config.pluginId,
      status: 'running',
      startTime: timestamp,
      results: {},
      logs: [],
      artifacts: []
    };

    // Create test working directory
    const testDir = path.join(process.cwd(), 'test-environments', testId);
    await fs.mkdir(testDir, { recursive: true });

    // Start test execution
    const testProcess = await startTestExecution(config, testResult, testDir);
    
    activeTests.set(testId, { process: testProcess, result: testResult });

    return NextResponse.json({
      success: true,
      testId,
      message: 'Test execution started',
      status: 'running'
    });

  } catch (error) {
    console.error('Plugin testing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('testId');
  const action = searchParams.get('action');

  try {
    if (action === 'list') {
      // Return list of all test results
      const testResults = Array.from(activeTests.values()).map(({ result }) => ({
        testId: result.testId,
        pluginId: result.pluginId,
        status: result.status,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.duration
      }));

      // Also load completed tests from storage
      const completedTests = await loadCompletedTests();
      
      return NextResponse.json({
        success: true,
        active: testResults,
        completed: completedTests
      });
    }

    if (!testId) {
      return NextResponse.json({
        success: false,
        error: 'testId is required'
      }, { status: 400 });
    }

    const activeTest = activeTests.get(testId);
    if (activeTest) {
      return NextResponse.json({
        success: true,
        result: activeTest.result
      });
    }

    // Check for completed test
    const completedResult = await loadTestResult(testId);
    if (completedResult) {
      return NextResponse.json({
        success: true,
        result: completedResult
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Test not found'
    }, { status: 404 });

  } catch (error) {
    console.error('Error fetching test result:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('testId');

  if (!testId) {
    return NextResponse.json({
      success: false,
      error: 'testId is required'
    }, { status: 400 });
  }

  try {
    const activeTest = activeTests.get(testId);
    if (activeTest) {
      // Cancel running test
      activeTest.process.kill('SIGTERM');
      activeTest.result.status = 'cancelled';
      activeTest.result.endTime = new Date().toISOString();
      
      // Save cancelled result
      await saveTestResult(activeTest.result);
      activeTests.delete(testId);

      return NextResponse.json({
        success: true,
        message: 'Test cancelled successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Test not found or already completed'
    }, { status: 404 });

  } catch (error) {
    console.error('Error cancelling test:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function startTestExecution(config: TestConfig, result: TestResult, testDir: string): Promise<ChildProcess> {
  // Setup test environment
  await setupTestEnvironment(config, testDir);

  // Create test script
  const testScript = await createTestScript(config, testDir);
  
  // Execute tests
  const testProcess = spawn('bash', [testScript], {
    cwd: testDir,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Handle test output
  testProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    result.logs.push(`[STDOUT] ${output}`);
    
    // Parse real-time test progress
    parseTestProgress(output, result);
  });

  testProcess.stderr?.on('data', (data) => {
    const output = data.toString();
    result.logs.push(`[STDERR] ${output}`);
  });

  testProcess.on('close', async (code) => {
    result.status = code === 0 ? 'passed' : 'failed';
    result.endTime = new Date().toISOString();
    result.duration = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

    // Parse final results
    await parseTestResults(testDir, result);
    
    // Generate coverage report if requested
    if (config.coverage) {
      result.coverage = await generateCoverageReport(testDir);
    }

    // Save test result
    await saveTestResult(result);
    
    // Cleanup
    activeTests.delete(result.testId);
    await cleanupTestEnvironment(testDir, config);
  });

  return testProcess;
}

async function setupTestEnvironment(config: TestConfig, testDir: string): Promise<void> {
  // Copy plugin source code
  const pluginPath = path.join(process.cwd(), 'plugins', config.pluginId);
  if (await fs.access(pluginPath).then(() => true).catch(() => false)) {
    await execAsync(`cp -r "${pluginPath}" "${testDir}/plugin"`);
  }

  // Setup package.json for testing
  const packageJson = {
    name: `${config.pluginId}-test`,
    version: '1.0.0',
    scripts: {
      'test:unit': 'jest --testMatch="**/__tests__/**/*.test.{js,ts}" --coverage',
      'test:integration': 'jest --testMatch="**/__tests__/**/*.integration.test.{js,ts}"',
      'test:e2e': 'playwright test',
      'test:performance': 'k6 run performance-tests.js',
      'test:security': 'npm audit --audit-level high && snyk test'
    },
    devDependencies: {
      '@jest/globals': '^29.7.0',
      '@playwright/test': '^1.40.0',
      '@testing-library/jest-dom': '^6.1.0',
      '@testing-library/react': '^14.0.0',
      '@types/jest': '^29.5.0',
      'jest': '^29.7.0',
      'jest-environment-jsdom': '^29.7.0',
      'k6': '^0.0.0',
      'snyk': '^1.1000.0',
      'typescript': '^5.0.0'
    }
  };

  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create Jest config
  const jestConfig = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    collectCoverageFrom: [
      'plugin/**/*.{js,ts,tsx}',
      '!plugin/**/*.d.ts',
      '!plugin/**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'json-summary'],
    testTimeout: config.timeout || 30000
  };

  await fs.writeFile(
    path.join(testDir, 'jest.config.js'),
    `module.exports = ${JSON.stringify(jestConfig, null, 2)};`
  );

  // Create jest setup file
  await fs.writeFile(
    path.join(testDir, 'jest.setup.js'),
    `
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '/',
    };
  },
}));

// Mock Backstage APIs
jest.mock('@backstage/catalog-client', () => ({
  CatalogApi: jest.fn(),
}));
`
  );

  // Create Playwright config
  const playwrightConfig = {
    testDir: './e2e',
    timeout: 30000,
    expect: { timeout: 5000 },
    use: {
      actionTimeout: 0,
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure'
    },
    projects: [
      { name: 'chromium', use: { ...require('@playwright/test').devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...require('@playwright/test').devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...require('@playwright/test').devices['Desktop Safari'] } }
    ]
  };

  await fs.writeFile(
    path.join(testDir, 'playwright.config.ts'),
    `export default ${JSON.stringify(playwrightConfig, null, 2)};`
  );

  // Create k6 performance test script
  const k6Script = `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/plugins/${config.pluginId}/health');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);
  
  sleep(1);
}
`;

  await fs.writeFile(path.join(testDir, 'performance-tests.js'), k6Script);

  // Setup Docker environment if requested
  if (config.environment === 'docker') {
    await setupDockerEnvironment(config, testDir);
  }
}

async function setupDockerEnvironment(config: TestConfig, testDir: string): Promise<void> {
  const dockerCompose = {
    version: '3.8',
    services: {
      'plugin-test': {
        build: {
          context: '.',
          dockerfile: 'Dockerfile.test'
        },
        ports: ['3000:3000'],
        environment: {
          NODE_ENV: 'test',
          ...config.config
        },
        volumes: [
          './plugin:/app/plugin',
          './coverage:/app/coverage'
        ],
        depends_on: config.dockerEnvironment === 'postgres' ? ['postgres'] : undefined
      },
      ...(config.dockerEnvironment === 'postgres' && {
        postgres: {
          image: 'postgres:15',
          environment: {
            POSTGRES_DB: 'test_db',
            POSTGRES_USER: 'test_user',
            POSTGRES_PASSWORD: 'test_password'
          },
          ports: ['5432:5432']
        }
      }),
      ...(config.dockerEnvironment === 'redis' && {
        redis: {
          image: 'redis:7',
          ports: ['6379:6379']
        }
      })
    }
  };

  await fs.writeFile(
    path.join(testDir, 'docker-compose.test.yml'),
    JSON.stringify(dockerCompose, null, 2)
  );

  const dockerfile = `
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "test:all"]
`;

  await fs.writeFile(path.join(testDir, 'Dockerfile.test'), dockerfile);
}

async function createTestScript(config: TestConfig, testDir: string): Promise<string> {
  const scriptPath = path.join(testDir, 'run-tests.sh');
  
  let script = `#!/bin/bash
set -e

echo "Starting plugin test execution for ${config.pluginId}"
echo "Test ID: ${path.basename(testDir)}"
echo "Test types: ${config.testTypes.join(', ')}"

# Install dependencies
npm install

`;

  if (config.environment === 'docker') {
    script += `
# Start Docker environment
docker-compose -f docker-compose.test.yml up -d
sleep 10

`;
  }

  for (const testType of config.testTypes) {
    switch (testType) {
      case 'unit':
        script += `
echo "Running unit tests..."
npm run test:unit -- --json --outputFile=unit-results.json || echo "Unit tests completed with errors"

`;
        break;

      case 'integration':
        script += `
echo "Running integration tests..."
npm run test:integration -- --json --outputFile=integration-results.json || echo "Integration tests completed with errors"

`;
        break;

      case 'e2e':
        script += `
echo "Running E2E tests..."
npx playwright install
npm run test:e2e --reporter=json > e2e-results.json || echo "E2E tests completed with errors"

`;
        break;

      case 'performance':
        script += `
echo "Running performance tests..."
npm run test:performance --summary-export=performance-results.json || echo "Performance tests completed with errors"

`;
        break;

      case 'security':
        script += `
echo "Running security tests..."
npm run test:security > security-results.txt 2>&1 || echo "Security tests completed with findings"

`;
        break;
    }
  }

  if (config.environment === 'docker') {
    script += `
# Cleanup Docker environment
docker-compose -f docker-compose.test.yml down

`;
  }

  script += `
echo "All tests completed"
`;

  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, 0o755);
  
  return scriptPath;
}

function parseTestProgress(output: string, result: TestResult): void {
  // Parse Jest test progress
  const jestProgressMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
  if (jestProgressMatch) {
    result.logs.push(`[PROGRESS] Tests: ${jestProgressMatch[1]} passed, ${jestProgressMatch[2]} failed`);
  }

  // Parse Playwright progress
  const playwrightMatch = output.match(/(\d+)\s+passed\s+\((\d+)s\)/);
  if (playwrightMatch) {
    result.logs.push(`[PROGRESS] E2E: ${playwrightMatch[1]} tests passed in ${playwrightMatch[2]}s`);
  }

  // Parse k6 progress
  const k6Match = output.match(/http_req_duration.*avg=(\d+\.?\d*)ms/);
  if (k6Match) {
    result.logs.push(`[PROGRESS] Performance: Average response time ${k6Match[1]}ms`);
  }
}

async function parseTestResults(testDir: string, result: TestResult): Promise<void> {
  // Parse unit test results
  try {
    const unitResults = await fs.readFile(path.join(testDir, 'unit-results.json'), 'utf8');
    const unitData = JSON.parse(unitResults);
    
    result.results.unit = {
      status: unitData.success ? 'passed' : 'failed',
      testCount: unitData.numTotalTests,
      passedCount: unitData.numPassedTests,
      failedCount: unitData.numFailedTests,
      skippedCount: unitData.numPendingTests,
      duration: unitData.testResults[0]?.endTime - unitData.testResults[0]?.startTime || 0,
      failures: unitData.testResults.flatMap((suite: any) => 
        suite.assertionResults
          .filter((test: any) => test.status === 'failed')
          .map((test: any) => ({
            testName: test.fullName,
            error: test.failureMessages[0],
            file: suite.name
          }))
      ),
      stdout: '',
      stderr: ''
    };
  } catch (error) {
    console.error('Failed to parse unit test results:', error);
  }

  // Parse integration test results
  try {
    const integrationResults = await fs.readFile(path.join(testDir, 'integration-results.json'), 'utf8');
    const integrationData = JSON.parse(integrationResults);
    
    result.results.integration = {
      status: integrationData.success ? 'passed' : 'failed',
      testCount: integrationData.numTotalTests,
      passedCount: integrationData.numPassedTests,
      failedCount: integrationData.numFailedTests,
      skippedCount: integrationData.numPendingTests,
      duration: integrationData.testResults[0]?.endTime - integrationData.testResults[0]?.startTime || 0,
      failures: [],
      stdout: '',
      stderr: ''
    };
  } catch (error) {
    console.error('Failed to parse integration test results:', error);
  }

  // Parse E2E test results
  try {
    const e2eResults = await fs.readFile(path.join(testDir, 'e2e-results.json'), 'utf8');
    const e2eData = JSON.parse(e2eResults);
    
    const totalTests = e2eData.suites.reduce((sum: number, suite: any) => sum + suite.tests.length, 0);
    const passedTests = e2eData.suites.reduce((sum: number, suite: any) => 
      sum + suite.tests.filter((test: any) => test.outcome === 'expected').length, 0
    );
    
    result.results.e2e = {
      status: e2eData.status === 'passed' ? 'passed' : 'failed',
      testCount: totalTests,
      passedCount: passedTests,
      failedCount: totalTests - passedTests,
      skippedCount: 0,
      duration: e2eData.stats.duration,
      failures: e2eData.suites.flatMap((suite: any) => 
        suite.tests
          .filter((test: any) => test.outcome !== 'expected')
          .map((test: any) => ({
            testName: test.title,
            error: test.results[0]?.error?.message || 'Test failed',
            file: suite.file
          }))
      ),
      stdout: '',
      stderr: ''
    };
  } catch (error) {
    console.error('Failed to parse E2E test results:', error);
  }

  // Parse performance test results
  try {
    const performanceResults = await fs.readFile(path.join(testDir, 'performance-results.json'), 'utf8');
    const perfData = JSON.parse(performanceResults);
    
    result.results.performance = {
      status: perfData.root_group.checks.filter((check: any) => !check.passes).length === 0 ? 'passed' : 'failed',
      metrics: {
        averageResponseTime: perfData.metrics.http_req_duration?.avg || 0,
        p95ResponseTime: perfData.metrics.http_req_duration?.p95 || 0,
        p99ResponseTime: perfData.metrics.http_req_duration?.p99 || 0,
        requestsPerSecond: perfData.metrics.http_reqs?.rate || 0,
        errorRate: perfData.metrics.errors?.rate || 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      thresholds: Object.fromEntries(
        Object.entries(perfData.thresholds || {}).map(([key, value]: [string, any]) => [
          key,
          value.ok
        ])
      ),
      k6Output: ''
    };
  } catch (error) {
    console.error('Failed to parse performance test results:', error);
  }

  // Parse security test results
  try {
    const securityResults = await fs.readFile(path.join(testDir, 'security-results.txt'), 'utf8');
    
    const vulnerabilities = {
      high: (securityResults.match(/high/gi) || []).length,
      medium: (securityResults.match(/medium/gi) || []).length,
      low: (securityResults.match(/low/gi) || []).length,
      info: (securityResults.match(/info/gi) || []).length
    };

    result.results.security = {
      status: vulnerabilities.high === 0 && vulnerabilities.medium === 0 ? 'passed' : 'failed',
      vulnerabilities,
      findings: [],
      tools: ['npm-audit', 'snyk']
    };
  } catch (error) {
    console.error('Failed to parse security test results:', error);
  }
}

async function generateCoverageReport(testDir: string): Promise<CoverageReport> {
  try {
    const coveragePath = path.join(testDir, 'coverage', 'coverage-summary.json');
    const coverageData = JSON.parse(await fs.readFile(coveragePath, 'utf8'));
    
    return {
      statements: {
        total: coverageData.total.statements.total,
        covered: coverageData.total.statements.covered,
        percentage: coverageData.total.statements.pct
      },
      branches: {
        total: coverageData.total.branches.total,
        covered: coverageData.total.branches.covered,
        percentage: coverageData.total.branches.pct
      },
      functions: {
        total: coverageData.total.functions.total,
        covered: coverageData.total.functions.covered,
        percentage: coverageData.total.functions.pct
      },
      lines: {
        total: coverageData.total.lines.total,
        covered: coverageData.total.lines.covered,
        percentage: coverageData.total.lines.pct
      },
      files: Object.entries(coverageData)
        .filter(([key]) => key !== 'total')
        .map(([filename, data]: [string, any]) => ({
          filename,
          statements: data.statements.pct,
          branches: data.branches.pct,
          functions: data.functions.pct,
          lines: data.lines.pct
        }))
    };
  } catch (error) {
    console.error('Failed to generate coverage report:', error);
    return {
      statements: { total: 0, covered: 0, percentage: 0 },
      branches: { total: 0, covered: 0, percentage: 0 },
      functions: { total: 0, covered: 0, percentage: 0 },
      lines: { total: 0, covered: 0, percentage: 0 },
      files: []
    };
  }
}

async function saveTestResult(result: TestResult): Promise<void> {
  const resultsDir = path.join(process.cwd(), 'test-results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  const resultPath = path.join(resultsDir, `${result.testId}.json`);
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
}

async function loadTestResult(testId: string): Promise<TestResult | null> {
  try {
    const resultPath = path.join(process.cwd(), 'test-results', `${testId}.json`);
    const data = await fs.readFile(resultPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function loadCompletedTests(): Promise<TestResult[]> {
  try {
    const resultsDir = path.join(process.cwd(), 'test-results');
    const files = await fs.readdir(resultsDir);
    
    const results = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          try {
            const data = await fs.readFile(path.join(resultsDir, file), 'utf8');
            return JSON.parse(data);
          } catch (error) {
            return null;
          }
        })
    );
    
    return results.filter(Boolean).slice(-50); // Return last 50 results
  } catch (error) {
    return [];
  }
}

async function cleanupTestEnvironment(testDir: string, config: TestConfig): Promise<void> {
  // Archive test artifacts
  const archiveDir = path.join(process.cwd(), 'test-archives', path.basename(testDir));
  await fs.mkdir(archiveDir, { recursive: true });
  
  // Copy important files
  const filesToArchive = ['coverage', 'test-results.json', '*.log'];
  for (const pattern of filesToArchive) {
    try {
      await execAsync(`cp -r "${testDir}/${pattern}" "${archiveDir}/" 2>/dev/null || true`);
    } catch (error) {
      // Ignore copy errors
    }
  }
  
  // Remove test directory after delay to allow for debugging
  setTimeout(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test directory:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes delay
}