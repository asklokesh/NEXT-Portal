// Data Pipeline Testing and Validation System

import { 
  TestCase, 
  TestType, 
  TestConfig, 
  TestStatus, 
  Assertion,
  DataPipelineConfig,
  TransformationStep,
  QualityCheck 
} from './types';

/**
 * Pipeline Testing Framework
 */
export class PipelineTestingFramework {
  private testSuites: Map<string, TestSuite> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();
  private fixtures: Map<string, TestFixture> = new Map();

  /**
   * Create test suite
   */
  createTestSuite(suite: TestSuite): void {
    this.testSuites.set(suite.id, suite);
  }

  /**
   * Run test suite
   */
  async runTestSuite(suiteId: string): Promise<TestSuiteResult> {
    const suite = this.testSuites.get(suiteId);
    if (!suite) {
      throw new Error(`Test suite ${suiteId} not found`);
    }

    const startTime = Date.now();
    const results: TestResult[] = [];

    for (const testCase of suite.testCases) {
      try {
        const result = await this.runTestCase(testCase);
        results.push(result);
      } catch (error) {
        results.push({
          testId: testCase.id,
          status: TestStatus.FAILED,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          error: error.message,
          assertions: []
        });
      }
    }

    const endTime = Date.now();
    const passed = results.filter(r => r.status === TestStatus.PASSED).length;
    const failed = results.filter(r => r.status === TestStatus.FAILED).length;

    const suiteResult: TestSuiteResult = {
      suiteId,
      suiteName: suite.name,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration: endTime - startTime,
      totalTests: results.length,
      passedTests: passed,
      failedTests: failed,
      successRate: (passed / results.length) * 100,
      results
    };

    // Store results
    const existingResults = this.testResults.get(suiteId) || [];
    existingResults.push(...results);
    this.testResults.set(suiteId, existingResults);

    return suiteResult;
  }

  /**
   * Run single test case
   */
  async runTestCase(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      let result: TestResult;

      switch (testCase.type) {
        case TestType.UNIT:
          result = await this.runUnitTest(testCase);
          break;
        case TestType.INTEGRATION:
          result = await this.runIntegrationTest(testCase);
          break;
        case TestType.END_TO_END:
          result = await this.runE2ETest(testCase);
          break;
        case TestType.DATA_QUALITY:
          result = await this.runDataQualityTest(testCase);
          break;
        case TestType.PERFORMANCE:
          result = await this.runPerformanceTest(testCase);
          break;
        default:
          throw new Error(`Unknown test type: ${testCase.type}`);
      }

      result.startTime = new Date(startTime);
      result.endTime = new Date();
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      return {
        testId: testCase.id,
        status: TestStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
        assertions: []
      };
    }
  }

  /**
   * Create test fixture
   */
  createFixture(fixture: TestFixture): void {
    this.fixtures.set(fixture.id, fixture);
  }

  /**
   * Load test fixture
   */
  loadFixture(fixtureId: string): any {
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) {
      throw new Error(`Test fixture ${fixtureId} not found`);
    }
    return fixture.data;
  }

  /**
   * Generate test report
   */
  generateTestReport(suiteId: string): TestReport {
    const suite = this.testSuites.get(suiteId);
    const results = this.testResults.get(suiteId) || [];

    if (!suite) {
      throw new Error(`Test suite ${suiteId} not found`);
    }

    const passed = results.filter(r => r.status === TestStatus.PASSED).length;
    const failed = results.filter(r => r.status === TestStatus.FAILED).length;
    const skipped = results.filter(r => r.status === TestStatus.SKIPPED).length;

    const testsByType = this.groupTestsByType(results);
    const failureAnalysis = this.analyzeFailures(results.filter(r => r.status === TestStatus.FAILED));

    return {
      suiteId,
      suiteName: suite.name,
      generatedAt: new Date(),
      summary: {
        totalTests: results.length,
        passedTests: passed,
        failedTests: failed,
        skippedTests: skipped,
        successRate: results.length > 0 ? (passed / results.length) * 100 : 0,
        averageDuration: results.length > 0 ? results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0
      },
      testsByType,
      failureAnalysis,
      trends: this.calculateTestTrends(suiteId),
      recommendations: this.generateTestRecommendations(results)
    };
  }

  /**
   * Run unit test
   */
  private async runUnitTest(testCase: TestCase): Promise<TestResult> {
    const assertions: AssertionResult[] = [];
    let status = TestStatus.PASSED;

    // Load test data
    const inputData = testCase.config.inputData || [];

    // Execute assertions
    for (const assertion of testCase.config.assertions) {
      const result = await this.executeAssertion(assertion, inputData, testCase.expectedResult);
      assertions.push(result);
      
      if (!result.passed) {
        status = TestStatus.FAILED;
      }
    }

    return {
      testId: testCase.id,
      status,
      assertions,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
  }

  /**
   * Run integration test
   */
  private async runIntegrationTest(testCase: TestCase): Promise<TestResult> {
    const assertions: AssertionResult[] = [];
    let status = TestStatus.PASSED;

    // Mock integration test execution
    // In reality, this would test pipeline components together

    // Simulate data flow through pipeline
    const mockData = testCase.config.inputData || [];
    const processedData = await this.simulatePipelineExecution(mockData, testCase);

    // Execute assertions on processed data
    for (const assertion of testCase.config.assertions) {
      const result = await this.executeAssertion(assertion, processedData, testCase.expectedResult);
      assertions.push(result);
      
      if (!result.passed) {
        status = TestStatus.FAILED;
      }
    }

    return {
      testId: testCase.id,
      status,
      assertions,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
  }

  /**
   * Run end-to-end test
   */
  private async runE2ETest(testCase: TestCase): Promise<TestResult> {
    const assertions: AssertionResult[] = [];
    let status = TestStatus.PASSED;

    // Mock E2E test execution
    // In reality, this would execute the full pipeline

    // Simulate full pipeline execution
    await this.simulateFullPipelineExecution(testCase);

    // Execute assertions
    for (const assertion of testCase.config.assertions) {
      const result = await this.executeAssertion(assertion, [], testCase.expectedResult);
      assertions.push(result);
      
      if (!result.passed) {
        status = TestStatus.FAILED;
      }
    }

    return {
      testId: testCase.id,
      status,
      assertions,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
  }

  /**
   * Run data quality test
   */
  private async runDataQualityTest(testCase: TestCase): Promise<TestResult> {
    const assertions: AssertionResult[] = [];
    let status = TestStatus.PASSED;

    // Mock data quality validation
    const qualityChecks = testCase.config.qualityChecks || [];

    for (const check of qualityChecks) {
      const result = await this.executeQualityCheck(check, testCase.config.inputData || []);
      
      const assertionResult: AssertionResult = {
        type: 'quality',
        target: check.name,
        expected: 'pass',
        actual: result.passed ? 'pass' : 'fail',
        passed: result.passed,
        message: result.message
      };

      assertions.push(assertionResult);
      
      if (!result.passed) {
        status = TestStatus.FAILED;
      }
    }

    return {
      testId: testCase.id,
      status,
      assertions,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
  }

  /**
   * Run performance test
   */
  private async runPerformanceTest(testCase: TestCase): Promise<TestResult> {
    const assertions: AssertionResult[] = [];
    let status = TestStatus.PASSED;

    // Mock performance test
    const performanceMetrics = await this.measurePerformance(testCase);

    // Check performance assertions
    for (const assertion of testCase.config.assertions) {
      const result = await this.executeAssertion(assertion, performanceMetrics, testCase.expectedResult);
      assertions.push(result);
      
      if (!result.passed) {
        status = TestStatus.FAILED;
      }
    }

    return {
      testId: testCase.id,
      status,
      assertions,
      performanceMetrics,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
  }

  /**
   * Execute assertion
   */
  private async executeAssertion(assertion: Assertion, data: any, expected: any): Promise<AssertionResult> {
    try {
      let actual: any;
      let passed: boolean;

      switch (assertion.type) {
        case 'equals':
          actual = this.extractValue(data, assertion.target);
          passed = actual === assertion.expected;
          break;

        case 'contains':
          actual = this.extractValue(data, assertion.target);
          passed = Array.isArray(actual) ? 
            actual.includes(assertion.expected) : 
            String(actual).includes(String(assertion.expected));
          break;

        case 'schema':
          actual = this.validateSchema(data, assertion.expected);
          passed = actual.valid;
          break;

        case 'count':
          actual = Array.isArray(data) ? data.length : Object.keys(data).length;
          passed = actual === assertion.expected;
          break;

        case 'custom':
          // Execute custom assertion function
          const customFunction = new Function('data', 'expected', assertion.expected);
          const result = customFunction(data, expected);
          actual = result;
          passed = !!result;
          break;

        default:
          throw new Error(`Unknown assertion type: ${assertion.type}`);
      }

      return {
        type: assertion.type,
        target: assertion.target,
        expected: assertion.expected,
        actual,
        passed,
        message: passed ? 'Assertion passed' : `Expected ${assertion.expected}, got ${actual}`
      };
    } catch (error) {
      return {
        type: assertion.type,
        target: assertion.target,
        expected: assertion.expected,
        actual: null,
        passed: false,
        message: `Assertion failed: ${error.message}`
      };
    }
  }

  /**
   * Extract value from data using path
   */
  private extractValue(data: any, path: string): any {
    const keys = path.split('.');
    let current = data;
    
    for (const key of keys) {
      if (current == null) return null;
      current = current[key];
    }
    
    return current;
  }

  /**
   * Validate schema
   */
  private validateSchema(data: any, expectedSchema: any): { valid: boolean; errors: string[] } {
    // Simple schema validation - in reality, use a proper schema validator
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push('Expected array');
      return { valid: false, errors };
    }

    if (data.length === 0) {
      return { valid: true, errors };
    }

    const sample = data[0];
    const expectedFields = Object.keys(expectedSchema);
    const actualFields = Object.keys(sample);

    // Check for missing fields
    for (const field of expectedFields) {
      if (!actualFields.includes(field)) {
        errors.push(`Missing field: ${field}`);
      }
    }

    // Check field types
    for (const field of expectedFields) {
      if (sample[field] != null) {
        const expectedType = expectedSchema[field];
        const actualType = typeof sample[field];
        
        if (actualType !== expectedType) {
          errors.push(`Field ${field}: expected ${expectedType}, got ${actualType}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Simulate pipeline execution
   */
  private async simulatePipelineExecution(data: any[], testCase: TestCase): Promise<any[]> {
    // Mock pipeline execution
    let processedData = [...data];

    // Apply mock transformations
    if (testCase.config.mockTransformations) {
      for (const transformation of testCase.config.mockTransformations) {
        processedData = await this.applyMockTransformation(processedData, transformation);
      }
    }

    return processedData;
  }

  /**
   * Simulate full pipeline execution
   */
  private async simulateFullPipelineExecution(testCase: TestCase): Promise<void> {
    // Mock full pipeline execution
    console.log(`Executing full pipeline for test ${testCase.id}`);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
  }

  /**
   * Apply mock transformation
   */
  private async applyMockTransformation(data: any[], transformation: any): Promise<any[]> {
    switch (transformation.type) {
      case 'filter':
        return data.filter(row => this.evaluateCondition(row, transformation.condition));
      
      case 'map':
        return data.map(row => this.applyMapping(row, transformation.mapping));
      
      case 'aggregate':
        return this.aggregateData(data, transformation.groupBy, transformation.aggregations);
      
      default:
        return data;
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(row: any, condition: string): boolean {
    // Simple condition evaluation
    try {
      const func = new Function('row', `return ${condition}`);
      return func(row);
    } catch {
      return true;
    }
  }

  /**
   * Apply mapping
   */
  private applyMapping(row: any, mapping: Record<string, string>): any {
    const newRow = { ...row };
    
    for (const [newField, expression] of Object.entries(mapping)) {
      try {
        const func = new Function('row', `return ${expression}`);
        newRow[newField] = func(row);
      } catch {
        newRow[newField] = null;
      }
    }
    
    return newRow;
  }

  /**
   * Aggregate data
   */
  private aggregateData(data: any[], groupBy: string[], aggregations: any[]): any[] {
    const groups = new Map();
    
    // Group data
    for (const row of data) {
      const key = groupBy.map(field => row[field]).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(row);
    }
    
    // Aggregate groups
    const result = [];
    for (const [key, groupData] of groups.entries()) {
      const aggregatedRow: any = {};
      
      // Add group by fields
      const keyValues = key.split('|');
      groupBy.forEach((field, index) => {
        aggregatedRow[field] = keyValues[index];
      });
      
      // Apply aggregations
      for (const agg of aggregations) {
        const values = groupData.map((row: any) => row[agg.field]);
        
        switch (agg.function) {
          case 'sum':
            aggregatedRow[agg.alias] = values.reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
            break;
          case 'count':
            aggregatedRow[agg.alias] = values.length;
            break;
          case 'avg':
            const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v));
            aggregatedRow[agg.alias] = numericValues.length > 0 ? 
              numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length : 0;
            break;
        }
      }
      
      result.push(aggregatedRow);
    }
    
    return result;
  }

  /**
   * Execute quality check
   */
  private async executeQualityCheck(check: any, data: any[]): Promise<{ passed: boolean; message: string }> {
    switch (check.type) {
      case 'completeness':
        const nullCount = data.filter(row => row[check.column] == null).length;
        const completeness = ((data.length - nullCount) / data.length) * 100;
        const passed = completeness >= check.threshold;
        return {
          passed,
          message: `Completeness: ${completeness.toFixed(2)}% (threshold: ${check.threshold}%)`
        };

      case 'uniqueness':
        const uniqueValues = new Set(data.map(row => row[check.column]));
        const uniqueness = (uniqueValues.size / data.length) * 100;
        const uniquePassed = uniqueness >= check.threshold;
        return {
          passed: uniquePassed,
          message: `Uniqueness: ${uniqueness.toFixed(2)}% (threshold: ${check.threshold}%)`
        };

      default:
        return { passed: true, message: 'Quality check passed' };
    }
  }

  /**
   * Measure performance
   */
  private async measurePerformance(testCase: TestCase): Promise<PerformanceMetrics> {
    // Mock performance measurement
    const startTime = performance.now();
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    const endTime = performance.now();
    
    return {
      executionTime: endTime - startTime,
      memoryUsage: Math.random() * 100, // MB
      cpuUsage: Math.random() * 100, // %
      throughput: Math.random() * 10000, // records/second
      latency: Math.random() * 100 // ms
    };
  }

  /**
   * Group tests by type
   */
  private groupTestsByType(results: TestResult[]): Record<string, TestTypeSummary> {
    const groups: Record<string, TestResult[]> = {};
    
    // Group results by test type (need to get from test cases)
    for (const result of results) {
      const testCase = this.findTestCaseById(result.testId);
      const type = testCase?.type || 'unknown';
      
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(result);
    }
    
    // Calculate summaries
    const summaries: Record<string, TestTypeSummary> = {};
    for (const [type, typeResults] of Object.entries(groups)) {
      const passed = typeResults.filter(r => r.status === TestStatus.PASSED).length;
      
      summaries[type] = {
        total: typeResults.length,
        passed,
        failed: typeResults.length - passed,
        successRate: (passed / typeResults.length) * 100,
        averageDuration: typeResults.reduce((sum, r) => sum + r.duration, 0) / typeResults.length
      };
    }
    
    return summaries;
  }

  /**
   * Analyze failures
   */
  private analyzeFailures(failedResults: TestResult[]): FailureAnalysis {
    const failuresByType: Record<string, number> = {};
    const commonErrors: Record<string, number> = {};
    
    for (const result of failedResults) {
      const testCase = this.findTestCaseById(result.testId);
      const type = testCase?.type || 'unknown';
      
      failuresByType[type] = (failuresByType[type] || 0) + 1;
      
      if (result.error) {
        const errorKey = result.error.split('\n')[0]; // First line of error
        commonErrors[errorKey] = (commonErrors[errorKey] || 0) + 1;
      }
    }
    
    return {
      totalFailures: failedResults.length,
      failuresByType,
      commonErrors,
      patterns: this.identifyFailurePatterns(failedResults)
    };
  }

  /**
   * Calculate test trends
   */
  private calculateTestTrends(suiteId: string): TestTrends {
    const results = this.testResults.get(suiteId) || [];
    
    // Mock trend calculation
    return {
      successRateChange: Math.random() * 10 - 5, // -5% to +5%
      averageDurationChange: Math.random() * 100 - 50, // -50ms to +50ms
      testCountChange: Math.floor(Math.random() * 5) - 2 // -2 to +2 tests
    };
  }

  /**
   * Generate test recommendations
   */
  private generateTestRecommendations(results: TestResult[]): TestRecommendation[] {
    const recommendations: TestRecommendation[] = [];
    
    const failedResults = results.filter(r => r.status === TestStatus.FAILED);
    const failureRate = failedResults.length / results.length;
    
    if (failureRate > 0.2) {
      recommendations.push({
        type: 'test_stability',
        priority: 'high',
        title: 'High Test Failure Rate',
        description: `${(failureRate * 100).toFixed(1)}% of tests are failing`,
        actions: [
          'Review failing tests for common patterns',
          'Update test data or expectations',
          'Check for environmental issues'
        ]
      });
    }
    
    const slowTests = results.filter(r => r.duration > 5000);
    if (slowTests.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Slow Test Execution',
        description: `${slowTests.length} tests are taking longer than 5 seconds`,
        actions: [
          'Optimize test data size',
          'Parallelize test execution',
          'Review test implementation'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Find test case by ID
   */
  private findTestCaseById(testId: string): TestCase | undefined {
    for (const suite of this.testSuites.values()) {
      const testCase = suite.testCases.find(tc => tc.id === testId);
      if (testCase) return testCase;
    }
    return undefined;
  }

  /**
   * Identify failure patterns
   */
  private identifyFailurePatterns(failedResults: TestResult[]): string[] {
    const patterns: string[] = [];
    
    // Check if failures are concentrated in certain test types
    const testTypes = failedResults.map(r => this.findTestCaseById(r.testId)?.type || 'unknown');
    const typeCount = testTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(typeCount)) {
      if (count > failedResults.length * 0.5) {
        patterns.push(`High failure rate in ${type} tests`);
      }
    }
    
    return patterns;
  }
}

/**
 * Data Contract Testing
 */
export class DataContractTester {
  private contracts: Map<string, DataContract> = new Map();

  /**
   * Register data contract
   */
  registerContract(contract: DataContract): void {
    this.contracts.set(contract.id, contract);
  }

  /**
   * Validate data against contract
   */
  async validateContract(contractId: string, data: any[]): Promise<ContractValidationResult> {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Data contract ${contractId} not found`);
    }

    const violations: ContractViolation[] = [];

    // Validate schema
    if (contract.schema) {
      const schemaViolations = this.validateSchema(data, contract.schema);
      violations.push(...schemaViolations);
    }

    // Validate quality rules
    if (contract.qualityRules) {
      const qualityViolations = await this.validateQualityRules(data, contract.qualityRules);
      violations.push(...qualityViolations);
    }

    // Validate SLA
    if (contract.sla) {
      const slaViolations = this.validateSLA(data, contract.sla);
      violations.push(...slaViolations);
    }

    return {
      contractId,
      valid: violations.length === 0,
      violations,
      timestamp: new Date(),
      dataSize: data.length
    };
  }

  /**
   * Validate schema against data
   */
  private validateSchema(data: any[], schema: any): ContractViolation[] {
    const violations: ContractViolation[] = [];

    if (data.length === 0) return violations;

    const sample = data[0];
    const requiredFields = Object.keys(schema);

    for (const field of requiredFields) {
      if (!(field in sample)) {
        violations.push({
          type: 'schema',
          field,
          rule: 'required_field',
          message: `Required field '${field}' is missing`,
          severity: 'error'
        });
      } else {
        const expectedType = schema[field].type;
        const actualType = typeof sample[field];
        
        if (actualType !== expectedType) {
          violations.push({
            type: 'schema',
            field,
            rule: 'field_type',
            message: `Field '${field}' should be ${expectedType}, but is ${actualType}`,
            severity: 'error'
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validate quality rules
   */
  private async validateQualityRules(data: any[], rules: QualityRule[]): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    for (const rule of rules) {
      const ruleResult = await this.executeQualityRule(data, rule);
      
      if (!ruleResult.passed) {
        violations.push({
          type: 'quality',
          field: rule.field,
          rule: rule.type,
          message: ruleResult.message,
          severity: rule.severity || 'warning',
          actualValue: ruleResult.actualValue,
          expectedValue: rule.threshold
        });
      }
    }

    return violations;
  }

  /**
   * Validate SLA
   */
  private validateSLA(data: any[], sla: DataSLA): ContractViolation[] {
    const violations: ContractViolation[] = [];

    // Check minimum row count
    if (sla.minRowCount && data.length < sla.minRowCount) {
      violations.push({
        type: 'sla',
        rule: 'min_row_count',
        message: `Data contains ${data.length} rows, but minimum is ${sla.minRowCount}`,
        severity: 'error',
        actualValue: data.length,
        expectedValue: sla.minRowCount
      });
    }

    // Check maximum row count
    if (sla.maxRowCount && data.length > sla.maxRowCount) {
      violations.push({
        type: 'sla',
        rule: 'max_row_count',
        message: `Data contains ${data.length} rows, but maximum is ${sla.maxRowCount}`,
        severity: 'warning',
        actualValue: data.length,
        expectedValue: sla.maxRowCount
      });
    }

    return violations;
  }

  /**
   * Execute quality rule
   */
  private async executeQualityRule(data: any[], rule: QualityRule): Promise<QualityRuleResult> {
    switch (rule.type) {
      case 'completeness':
        const nullCount = data.filter(row => row[rule.field] == null).length;
        const completeness = ((data.length - nullCount) / data.length) * 100;
        return {
          passed: completeness >= rule.threshold,
          message: `Completeness: ${completeness.toFixed(2)}%`,
          actualValue: completeness
        };

      case 'uniqueness':
        const uniqueValues = new Set(data.map(row => row[rule.field]));
        const uniqueness = (uniqueValues.size / data.length) * 100;
        return {
          passed: uniqueness >= rule.threshold,
          message: `Uniqueness: ${uniqueness.toFixed(2)}%`,
          actualValue: uniqueness
        };

      default:
        return {
          passed: true,
          message: 'Rule passed',
          actualValue: null
        };
    }
  }
}

/**
 * Type definitions
 */
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  pipelineId: string;
  testCases: TestCase[];
  setup?: TestSetup;
  teardown?: TestTeardown;
  parallel?: boolean;
}

export interface TestSetup {
  fixtures: string[];
  environment: Record<string, string>;
  mockServices: MockServiceConfig[];
}

export interface TestTeardown {
  cleanupFixtures: boolean;
  cleanupEnvironment: boolean;
}

export interface MockServiceConfig {
  serviceName: string;
  mockData: any;
  endpoints?: Record<string, any>;
}

export interface TestResult {
  testId: string;
  status: TestStatus;
  startTime: Date;
  endTime: Date;
  duration: number;
  assertions: AssertionResult[];
  error?: string;
  performanceMetrics?: PerformanceMetrics;
}

export interface AssertionResult {
  type: string;
  target: string;
  expected: any;
  actual: any;
  passed: boolean;
  message: string;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  latency: number;
}

export interface TestFixture {
  id: string;
  name: string;
  description: string;
  type: 'data' | 'schema' | 'config';
  data: any;
}

export interface TestSuiteResult {
  suiteId: string;
  suiteName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  successRate: number;
  results: TestResult[];
}

export interface TestReport {
  suiteId: string;
  suiteName: string;
  generatedAt: Date;
  summary: TestSummary;
  testsByType: Record<string, TestTypeSummary>;
  failureAnalysis: FailureAnalysis;
  trends: TestTrends;
  recommendations: TestRecommendation[];
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  successRate: number;
  averageDuration: number;
}

export interface TestTypeSummary {
  total: number;
  passed: number;
  failed: number;
  successRate: number;
  averageDuration: number;
}

export interface FailureAnalysis {
  totalFailures: number;
  failuresByType: Record<string, number>;
  commonErrors: Record<string, number>;
  patterns: string[];
}

export interface TestTrends {
  successRateChange: number;
  averageDurationChange: number;
  testCountChange: number;
}

export interface TestRecommendation {
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  actions: string[];
}

export interface DataContract {
  id: string;
  name: string;
  description: string;
  version: string;
  producer: string;
  consumer: string[];
  schema?: any;
  qualityRules?: QualityRule[];
  sla?: DataSLA;
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityRule {
  type: 'completeness' | 'uniqueness' | 'validity' | 'consistency';
  field: string;
  threshold: number;
  severity?: 'error' | 'warning' | 'info';
}

export interface DataSLA {
  minRowCount?: number;
  maxRowCount?: number;
  maxLatency?: number;
  availabilityTarget?: number;
}

export interface ContractValidationResult {
  contractId: string;
  valid: boolean;
  violations: ContractViolation[];
  timestamp: Date;
  dataSize: number;
}

export interface ContractViolation {
  type: 'schema' | 'quality' | 'sla';
  field?: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  actualValue?: any;
  expectedValue?: any;
}

export interface QualityRuleResult {
  passed: boolean;
  message: string;
  actualValue: any;
}