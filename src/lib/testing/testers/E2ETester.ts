/**
 * E2E Tester
 * End-to-End testing using Playwright
 */

import { EventEmitter } from 'events';
import { TestSuite, TestResult } from '../TestingFramework';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class E2ETester extends EventEmitter {
  constructor() {
    super();
  }

  public async execute(suite: TestSuite): Promise<TestResult> {
    this.emit('test:started', suite);
    const startTime = Date.now();

    try {
      const result = await this.runPlaywrightTests(suite);
      const duration = Date.now() - startTime;
      
      this.emit('test:completed', suite, result);
      return result;
    } catch (error) {
      this.emit('test:error', suite, error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('npx playwright --version', { timeout: 10000 });
      return stdout.includes('Version');
    } catch (error) {
      return false;
    }
  }

  private async runPlaywrightTests(suite: TestSuite): Promise<TestResult> {
    const playwrightArgs = this.buildPlaywrightArgs(suite);
    const command = `npx playwright test ${playwrightArgs.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: suite.timeout || 600000, // 10 minutes default
        cwd: process.cwd()
      });

      return this.parsePlaywrightOutput(suite, stdout, stderr);
    } catch (error) {
      return this.handlePlaywrightError(suite, error);
    }
  }

  private buildPlaywrightArgs(suite: TestSuite): string[] {
    const args = [
      '--reporter=json',
      '--output-dir=test-results'
    ];

    if (suite.config?.testPattern) {
      args.push(suite.config.testPattern);
    }

    if (suite.config?.headed) {
      args.push('--headed');
    }

    if (suite.config?.project) {
      args.push(`--project=${suite.config.project}`);
    }

    if (suite.config?.workers) {
      args.push(`--workers=${suite.config.workers}`);
    }

    return args;
  }

  private parsePlaywrightOutput(suite: TestSuite, stdout: string, stderr: string): TestResult {
    try {
      const playwrightResult = JSON.parse(stdout);
      
      return {
        suiteId: suite.id,
        status: this.determineStatus(playwrightResult),
        duration: playwrightResult.stats?.duration || 0,
        errors: this.extractErrors(playwrightResult.suites),
        metrics: {
          executionTime: playwrightResult.stats?.duration || 0,
          memoryUsage: 0,
          cpuUsage: 0,
          networkCalls: this.countNetworkCalls(playwrightResult),
          databaseQueries: 0,
          cacheHits: 0,
          cacheMisses: 0
        },
        timestamp: new Date(),
        artifacts: [`e2e-report-${suite.id}-${Date.now()}.json`]
      };
    } catch (error) {
      return {
        suiteId: suite.id,
        status: 'error',
        duration: 0,
        errors: [{ message: 'Failed to parse Playwright output', type: 'ParseError' }],
        timestamp: new Date()
      };
    }
  }

  private determineStatus(result: any): 'passed' | 'failed' | 'error' {
    if (result.stats?.failed > 0) return 'failed';
    if (result.stats?.passed > 0) return 'passed';
    return 'error';
  }

  private extractErrors(suites: any[]): any[] {
    const errors = [];
    
    const extractFromTests = (tests: any[]) => {
      tests.forEach(test => {
        if (test.status === 'failed') {
          test.results.forEach((result: any) => {
            if (result.status === 'failed') {
              errors.push({
                message: result.error?.message || 'E2E test failed',
                type: 'E2ETestFailure',
                file: test.location?.file,
                line: test.location?.line
              });
            }
          });
        }
      });
    };

    suites.forEach(suite => {
      if (suite.tests) extractFromTests(suite.tests);
      if (suite.suites) this.extractErrors(suite.suites);
    });

    return errors;
  }

  private countNetworkCalls(result: any): number {
    // This would require parsing network logs from Playwright
    // For now, estimate based on test count
    return (result.stats?.passed || 0) * 5; // Assume 5 network calls per test
  }

  private handlePlaywrightError(suite: TestSuite, error: any): TestResult {
    return {
      suiteId: suite.id,
      status: 'error',
      duration: 0,
      errors: [{
        message: error.message || 'Playwright execution failed',
        type: 'ExecutionError',
        stack: error.stack
      }],
      timestamp: new Date()
    };
  }
}

export default E2ETester;