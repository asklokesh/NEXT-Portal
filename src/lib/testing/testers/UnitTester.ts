/**
 * Unit Tester
 * Executes Jest-based unit tests with enhanced reporting
 */

import { EventEmitter } from 'events';
import { TestSuite, TestResult } from '../TestingFramework';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class UnitTester extends EventEmitter {
  constructor() {
    super();
  }

  public async execute(suite: TestSuite): Promise<TestResult> {
    this.emit('test:started', suite);
    const startTime = Date.now();

    try {
      const result = await this.runJestTests(suite);
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
      const { stdout } = await execAsync('npx jest --version', { timeout: 10000 });
      return stdout.includes('.');
    } catch (error) {
      return false;
    }
  }

  private async runJestTests(suite: TestSuite): Promise<TestResult> {
    const jestArgs = this.buildJestArgs(suite);
    const command = `npx jest ${jestArgs.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: suite.timeout || 300000,
        cwd: process.cwd()
      });

      return this.parseJestOutput(suite, stdout, stderr);
    } catch (error) {
      return this.handleJestError(suite, error);
    }
  }

  private buildJestArgs(suite: TestSuite): string[] {
    const args = [
      '--json',
      '--coverage',
      '--verbose',
      '--forceExit',
      '--detectOpenHandles'
    ];

    if (suite.config?.testPattern) {
      args.push(`--testPathPattern="${suite.config.testPattern}"`);
    }

    if (suite.config?.testTimeout) {
      args.push(`--testTimeout=${suite.config.testTimeout}`);
    }

    if (suite.config?.maxWorkers) {
      args.push(`--maxWorkers=${suite.config.maxWorkers}`);
    }

    return args;
  }

  private parseJestOutput(suite: TestSuite, stdout: string, stderr: string): TestResult {
    try {
      const jestResult = JSON.parse(stdout);
      
      return {
        suiteId: suite.id,
        status: jestResult.success ? 'passed' : 'failed',
        duration: jestResult.runTime || 0,
        coverage: this.extractCoverage(jestResult.coverageMap),
        errors: this.extractErrors(jestResult.testResults),
        metrics: {
          executionTime: jestResult.runTime || 0,
          memoryUsage: 0,
          cpuUsage: 0,
          networkCalls: 0,
          databaseQueries: 0,
          cacheHits: 0,
          cacheMisses: 0
        },
        timestamp: new Date(),
        artifacts: [`jest-report-${suite.id}-${Date.now()}.json`]
      };
    } catch (error) {
      return {
        suiteId: suite.id,
        status: 'error',
        duration: 0,
        errors: [{ message: 'Failed to parse Jest output', type: 'ParseError' }],
        timestamp: new Date()
      };
    }
  }

  private extractCoverage(coverageMap: any): any {
    if (!coverageMap) return undefined;

    // Calculate aggregate coverage from Jest coverage map
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalStatements = 0;
    let coveredStatements = 0;

    Object.values(coverageMap).forEach((file: any) => {
      if (file.lines) {
        totalLines += Object.keys(file.lines).length;
        coveredLines += Object.values(file.lines).filter(Boolean).length;
      }
      if (file.functions) {
        totalFunctions += Object.keys(file.functions).length;
        coveredFunctions += Object.values(file.functions).filter(Boolean).length;
      }
      if (file.branches) {
        totalBranches += Object.keys(file.branches).length;
        coveredBranches += Object.values(file.branches).filter(Boolean).length;
      }
      if (file.statements) {
        totalStatements += Object.keys(file.statements).length;
        coveredStatements += Object.values(file.statements).filter(Boolean).length;
      }
    });

    return {
      lines: {
        covered: coveredLines,
        total: totalLines,
        percentage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
      },
      functions: {
        covered: coveredFunctions,
        total: totalFunctions,
        percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0
      },
      branches: {
        covered: coveredBranches,
        total: totalBranches,
        percentage: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0
      },
      statements: {
        covered: coveredStatements,
        total: totalStatements,
        percentage: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0
      }
    };
  }

  private extractErrors(testResults: any[]): any[] {
    const errors = [];

    testResults.forEach(result => {
      if (result.status === 'failed') {
        result.assertionResults.forEach((assertion: any) => {
          if (assertion.status === 'failed') {
            errors.push({
              message: assertion.failureMessages[0] || 'Test failed',
              type: 'TestFailure',
              file: result.name,
              line: assertion.location?.line
            });
          }
        });
      }
    });

    return errors;
  }

  private handleJestError(suite: TestSuite, error: any): TestResult {
    return {
      suiteId: suite.id,
      status: 'error',
      duration: 0,
      errors: [{
        message: error.message || 'Jest execution failed',
        type: 'ExecutionError',
        stack: error.stack
      }],
      timestamp: new Date()
    };
  }
}

export default UnitTester;