/**
 * Test Orchestrator
 * Manages test suite execution with parallel processing and intelligent scheduling
 */

import { EventEmitter } from 'events';
import { TestSuite, TestResult } from './TestingFramework';
import { ContractTester } from './testers/ContractTester';
import { IntegrationTester } from './testers/IntegrationTester';
import { PerformanceTester } from './testers/PerformanceTester';
import { ChaosTester } from './testers/ChaosTester';
import { SecurityTester } from './testers/SecurityTester';
import { UnitTester } from './testers/UnitTester';
import { E2ETester } from './testers/E2ETester';

export interface TestOrchestrationConfig {
  parallel: boolean;
  maxConcurrency: number;
  timeout: number;
  retries: number;
  failFast: boolean;
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalEstimatedTime: number;
  resourceRequirements: ResourceRequirements;
}

export interface ExecutionPhase {
  id: string;
  name: string;
  order: number;
  suites: string[];
  parallel: boolean;
  dependencies: string[];
  estimatedTime: number;
}

export interface ResourceRequirements {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  environments: string[];
}

export interface ExecutionContext {
  suiteId: string;
  phase: string;
  startTime: Date;
  environment?: string;
  resources?: any;
  metadata?: Record<string, any>;
}

export class TestOrchestrator extends EventEmitter {
  private config: TestOrchestrationConfig;
  private testers: Map<string, any> = new Map();
  private executionQueue: TestSuite[] = [];
  private runningTests: Map<string, ExecutionContext> = new Map();
  private completedTests: Map<string, TestResult> = new Map();

  constructor(config: TestOrchestrationConfig) {
    super();
    this.config = config;
    this.initializeTesters();
  }

  /**
   * Execute a collection of test suites
   */
  public async execute(suites: TestSuite[]): Promise<Map<string, TestResult>> {
    if (suites.length === 0) {
      throw new Error('No test suites provided for execution');
    }

    this.emit('orchestration:started', { totalSuites: suites.length });

    try {
      // Create execution plan
      const plan = this.createExecutionPlan(suites);
      this.emit('orchestration:plan-created', plan);

      // Execute phases in order
      for (const phase of plan.phases) {
        await this.executePhase(phase, suites);
      }

      this.emit('orchestration:completed', {
        results: this.completedTests,
        summary: this.createExecutionSummary()
      });

      return new Map(this.completedTests);
    } catch (error) {
      this.emit('orchestration:error', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Health check for the orchestrator
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if all testers are healthy
      const testerHealthChecks = await Promise.all(
        Array.from(this.testers.values()).map(tester => 
          tester.healthCheck ? tester.healthCheck() : Promise.resolve(true)
        )
      );

      return testerHealthChecks.every(check => check === true);
    } catch (error) {
      this.emit('orchestrator:health-check-failed', error);
      return false;
    }
  }

  /**
   * Get execution statistics
   */
  public getExecutionStats(): any {
    return {
      running: this.runningTests.size,
      completed: this.completedTests.size,
      queued: this.executionQueue.length,
      totalProcessed: this.completedTests.size + this.runningTests.size
    };
  }

  private initializeTesters(): void {
    this.testers.set('unit', new UnitTester());
    this.testers.set('integration', new IntegrationTester());
    this.testers.set('e2e', new E2ETester());
    this.testers.set('performance', new PerformanceTester());
    this.testers.set('security', new SecurityTester());
    this.testers.set('contract', new ContractTester());
    this.testers.set('chaos', new ChaosTester());

    // Setup tester event listeners
    this.testers.forEach((tester, type) => {
      tester.on('test:started', (suite: TestSuite) => {
        this.emit('suite:started', suite);
      });

      tester.on('test:progress', (suite: TestSuite, progress: any) => {
        this.emit('suite:progress', suite, progress);
      });

      tester.on('test:completed', (suite: TestSuite, result: TestResult) => {
        this.completedTests.set(suite.id, result);
        this.runningTests.delete(suite.id);
        this.emit('suite:completed', suite, result);
      });

      tester.on('test:error', (suite: TestSuite, error: Error) => {
        const errorResult: TestResult = {
          suiteId: suite.id,
          status: 'error',
          duration: Date.now() - (this.runningTests.get(suite.id)?.startTime?.getTime() || Date.now()),
          errors: [{
            message: error.message,
            stack: error.stack,
            type: error.constructor.name
          }],
          timestamp: new Date()
        };
        this.completedTests.set(suite.id, errorResult);
        this.runningTests.delete(suite.id);
        this.emit('suite:error', suite, error);
      });
    });
  }

  private createExecutionPlan(suites: TestSuite[]): ExecutionPlan {
    const phases: ExecutionPhase[] = [];
    const sortedSuites = this.sortSuitesByDependencies(suites);
    
    // Group suites by priority and dependencies
    const criticalSuites = sortedSuites.filter(s => s.priority === 'critical');
    const highSuites = sortedSuites.filter(s => s.priority === 'high');
    const mediumSuites = sortedSuites.filter(s => s.priority === 'medium');
    const lowSuites = sortedSuites.filter(s => s.priority === 'low');

    // Create phases based on test types and dependencies
    let phaseOrder = 0;

    // Phase 1: Critical unit and contract tests (parallel)
    if (criticalSuites.length > 0) {
      phases.push({
        id: 'critical-tests',
        name: 'Critical Tests',
        order: phaseOrder++,
        suites: criticalSuites.map(s => s.id),
        parallel: true,
        dependencies: [],
        estimatedTime: this.estimatePhaseTime(criticalSuites)
      });
    }

    // Phase 2: Integration tests (may have dependencies)
    const integrationSuites = sortedSuites.filter(s => s.type === 'integration');
    if (integrationSuites.length > 0) {
      phases.push({
        id: 'integration-tests',
        name: 'Integration Tests',
        order: phaseOrder++,
        suites: integrationSuites.map(s => s.id),
        parallel: integrationSuites.every(s => s.parallel),
        dependencies: criticalSuites.length > 0 ? ['critical-tests'] : [],
        estimatedTime: this.estimatePhaseTime(integrationSuites)
      });
    }

    // Phase 3: E2E tests (sequential, depends on integration)
    const e2eSuites = sortedSuites.filter(s => s.type === 'e2e');
    if (e2eSuites.length > 0) {
      phases.push({
        id: 'e2e-tests',
        name: 'End-to-End Tests',
        order: phaseOrder++,
        suites: e2eSuites.map(s => s.id),
        parallel: false,
        dependencies: integrationSuites.length > 0 ? ['integration-tests'] : 
                     criticalSuites.length > 0 ? ['critical-tests'] : [],
        estimatedTime: this.estimatePhaseTime(e2eSuites)
      });
    }

    // Phase 4: Performance tests (parallel, but after functional tests)
    const performanceSuites = sortedSuites.filter(s => s.type === 'performance');
    if (performanceSuites.length > 0) {
      phases.push({
        id: 'performance-tests',
        name: 'Performance Tests',
        order: phaseOrder++,
        suites: performanceSuites.map(s => s.id),
        parallel: true,
        dependencies: ['e2e-tests'],
        estimatedTime: this.estimatePhaseTime(performanceSuites)
      });
    }

    // Phase 5: Security tests (parallel with performance)
    const securitySuites = sortedSuites.filter(s => s.type === 'security');
    if (securitySuites.length > 0) {
      phases.push({
        id: 'security-tests',
        name: 'Security Tests',
        order: phaseOrder++,
        suites: securitySuites.map(s => s.id),
        parallel: true,
        dependencies: ['e2e-tests'],
        estimatedTime: this.estimatePhaseTime(securitySuites)
      });
    }

    // Phase 6: Chaos tests (last, as they may disrupt other tests)
    const chaosSuites = sortedSuites.filter(s => s.type === 'chaos');
    if (chaosSuites.length > 0) {
      phases.push({
        id: 'chaos-tests',
        name: 'Chaos Engineering Tests',
        order: phaseOrder++,
        suites: chaosSuites.map(s => s.id),
        parallel: false,
        dependencies: ['performance-tests', 'security-tests'].filter(dep => 
          phases.some(p => p.id === dep)
        ),
        estimatedTime: this.estimatePhaseTime(chaosSuites)
      });
    }

    const totalEstimatedTime = phases.reduce((sum, phase) => sum + phase.estimatedTime, 0);
    const resourceRequirements = this.calculateResourceRequirements(suites);

    return {
      phases,
      totalEstimatedTime,
      resourceRequirements
    };
  }

  private async executePhase(phase: ExecutionPhase, allSuites: TestSuite[]): Promise<void> {
    const phaseSuites = allSuites.filter(suite => phase.suites.includes(suite.id));
    
    this.emit('phase:started', phase);

    try {
      if (phase.parallel && this.config.parallel) {
        await this.executeParallel(phaseSuites);
      } else {
        await this.executeSequential(phaseSuites);
      }
      
      this.emit('phase:completed', phase);
    } catch (error) {
      this.emit('phase:error', phase, error);
      
      if (this.config.failFast) {
        throw error;
      }
    }
  }

  private async executeParallel(suites: TestSuite[]): Promise<void> {
    const concurrency = Math.min(this.config.maxConcurrency, suites.length);
    const semaphore = new Array(concurrency).fill(null);
    
    const executeWithSemaphore = async (suite: TestSuite): Promise<void> => {
      // Wait for available slot
      await new Promise<void>((resolve) => {
        const checkSlot = () => {
          const availableSlot = semaphore.findIndex(slot => slot === null);
          if (availableSlot !== -1) {
            semaphore[availableSlot] = suite.id;
            resolve();
          } else {
            setTimeout(checkSlot, 100);
          }
        };
        checkSlot();
      });

      try {
        await this.executeSingle(suite);
      } finally {
        const slotIndex = semaphore.indexOf(suite.id);
        if (slotIndex !== -1) {
          semaphore[slotIndex] = null;
        }
      }
    };

    await Promise.all(suites.map(suite => executeWithSemaphore(suite)));
  }

  private async executeSequential(suites: TestSuite[]): Promise<void> {
    for (const suite of suites) {
      await this.executeSingle(suite);
      
      if (this.config.failFast && this.completedTests.get(suite.id)?.status === 'failed') {
        throw new Error(`Test suite ${suite.id} failed and failFast is enabled`);
      }
    }
  }

  private async executeSingle(suite: TestSuite): Promise<void> {
    const tester = this.testers.get(suite.type);
    if (!tester) {
      throw new Error(`No tester found for suite type: ${suite.type}`);
    }

    const context: ExecutionContext = {
      suiteId: suite.id,
      phase: this.getCurrentPhase(suite),
      startTime: new Date(),
      environment: suite.environment,
      metadata: { ...suite.config }
    };

    this.runningTests.set(suite.id, context);

    try {
      await this.executeWithRetry(tester, suite);
    } catch (error) {
      // Error handling is done in tester event listeners
      throw error;
    }
  }

  private async executeWithRetry(tester: any, suite: TestSuite): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        await Promise.race([
          tester.execute(suite),
          this.createTimeoutPromise(suite.timeout || this.config.timeout)
        ]);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retries) {
          this.emit('suite:retry', suite, attempt + 1, error);
          await this.delay(1000 * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test execution timeout')), timeout);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private sortSuitesByDependencies(suites: TestSuite[]): TestSuite[] {
    const sorted: TestSuite[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (suite: TestSuite) => {
      if (visiting.has(suite.id)) {
        throw new Error(`Circular dependency detected: ${suite.id}`);
      }
      
      if (visited.has(suite.id)) return;

      visiting.add(suite.id);

      // Visit dependencies first
      suite.dependencies.forEach(depId => {
        const depSuite = suites.find(s => s.id === depId);
        if (depSuite) {
          visit(depSuite);
        }
      });

      visiting.delete(suite.id);
      visited.add(suite.id);
      sorted.push(suite);
    };

    suites.forEach(suite => {
      if (!visited.has(suite.id)) {
        visit(suite);
      }
    });

    return sorted;
  }

  private estimatePhaseTime(suites: TestSuite[]): number {
    return suites.reduce((total, suite) => {
      const baseTime = suite.timeout || this.config.timeout;
      const retryTime = baseTime * this.config.retries * 0.5; // Assume 50% will retry
      return total + baseTime + retryTime;
    }, 0);
  }

  private calculateResourceRequirements(suites: TestSuite[]): ResourceRequirements {
    const environments = new Set<string>();
    
    suites.forEach(suite => {
      if (suite.environment) {
        environments.add(suite.environment);
      }
    });

    return {
      cpu: Math.min(this.config.maxConcurrency * 2, 8), // 2 cores per concurrent test, max 8
      memory: this.config.maxConcurrency * 512, // 512MB per concurrent test
      storage: suites.length * 100, // 100MB per test suite for artifacts
      network: this.config.maxConcurrency * 10, // 10 Mbps per concurrent test
      environments: Array.from(environments)
    };
  }

  private getCurrentPhase(suite: TestSuite): string {
    // Determine which phase this suite belongs to
    switch (suite.type) {
      case 'unit':
      case 'contract':
        return suite.priority === 'critical' ? 'critical-tests' : 'unit-tests';
      case 'integration':
        return 'integration-tests';
      case 'e2e':
        return 'e2e-tests';
      case 'performance':
        return 'performance-tests';
      case 'security':
        return 'security-tests';
      case 'chaos':
        return 'chaos-tests';
      default:
        return 'unknown';
    }
  }

  private createExecutionSummary(): any {
    const results = Array.from(this.completedTests.values());
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const errors = results.filter(r => r.status === 'error').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return {
      total: results.length,
      passed,
      failed,
      errors,
      skipped,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      averageDuration: results.length > 0 ? 
        results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0
    };
  }

  private cleanup(): void {
    this.executionQueue = [];
    this.runningTests.clear();
    // Don't clear completedTests as they may be needed for reporting
  }
}

export default TestOrchestrator;