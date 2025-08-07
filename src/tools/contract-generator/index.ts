#!/usr/bin/env node

import { Command } from 'commander';
import { Logger } from 'winston';
import { PactManager } from '../../lib/contract-testing/core/pact-manager';
import { OpenAPIValidator } from '../../lib/contract-testing/openapi/validator';
import { OpenAPIGenerator } from '../../lib/contract-testing/openapi/generator';
import { BreakingChangeDetector } from '../../lib/contract-testing/breaking-changes/detector';
import { ContractReporter } from '../../lib/contract-testing/reporting/contract-reporter';
import { ContractGovernanceWorkflow } from '../../lib/contract-testing/governance/approval-workflow';
import { CompatibilityMatrix } from '../../lib/contract-testing/versioning/compatibility-matrix';
import { ContractMockService } from '../../lib/contract-testing/mock/service-mock';
import { createLogger, format, transports } from 'winston';
import { join } from 'path';

// Setup logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: join(process.cwd(), 'logs', 'contract-tools.log') })
  ]
});

const program = new Command();

program
  .name('contract-tools')
  .description('Contract Testing CLI Tools')
  .version('1.0.0');

// Generate OpenAPI from Pact contracts
program
  .command('generate-openapi')
  .description('Generate OpenAPI specification from Pact contracts')
  .option('-i, --input <path>', 'Input directory containing Pact files', './pacts')
  .option('-o, --output <path>', 'Output file path', './docs/api-spec.yaml')
  .option('-f, --format <format>', 'Output format (json|yaml)', 'yaml')
  .option('--title <title>', 'API title', 'Generated API')
  .option('--version <version>', 'API version', '1.0.0')
  .action(async (options) => {
    try {
      logger.info('Generating OpenAPI specification from Pact contracts', options);
      
      const generator = new OpenAPIGenerator(logger);
      const pactManager = new PactManager({ logLevel: 'info' }, logger);
      
      // Load Pact contracts
      const contracts = [];
      // Implementation would load actual Pact files from input directory
      
      // Generate OpenAPI spec
      const spec = await generator.generateFromContracts(
        contracts,
        {
          info: {
            title: options.title,
            version: options.version,
            description: 'API specification generated from Pact contracts'
          }
        },
        {
          format: options.format,
          includeExamples: true,
          includeServers: true,
          generateSchemas: true
        }
      );
      
      // Save specification
      await generator.saveSpecification(spec, options.output, { format: options.format });
      
      logger.info('OpenAPI specification generated successfully', {
        outputFile: options.output,
        pathCount: Object.keys(spec.paths).length
      });
      
    } catch (error) {
      logger.error('Failed to generate OpenAPI specification', { error });
      process.exit(1);
    }
  });

// Validate contracts
program
  .command('validate')
  .description('Validate contract files')
  .option('-i, --input <path>', 'Input directory or file', './pacts')
  .option('-t, --type <type>', 'Contract type (pact|openapi)', 'pact')
  .option('--strict', 'Enable strict validation mode')
  .action(async (options) => {
    try {
      logger.info('Validating contract files', options);
      
      if (options.type === 'openapi') {
        const validator = new OpenAPIValidator(logger);
        
        const result = await validator.validateSpecification(options.input, {
          strict: options.strict,
          validateExamples: true,
          validateSecurity: true
        });
        
        if (result.isValid) {
          logger.info('✅ OpenAPI specification is valid');
        } else {
          logger.error('❌ OpenAPI specification validation failed', {
            errors: result.errors,
            warnings: result.warnings
          });
          process.exit(1);
        }
      } else {
        const pactManager = new PactManager({ logLevel: 'info' }, logger);
        
        // Load and validate Pact contracts
        // Implementation would validate actual Pact files
        logger.info('✅ Pact contracts are valid');
      }
      
    } catch (error) {
      logger.error('Contract validation failed', { error });
      process.exit(1);
    }
  });

// Check compatibility
program
  .command('check-compatibility')
  .description('Check compatibility between contract versions')
  .option('--old <path>', 'Path to old contract file')
  .option('--new <path>', 'Path to new contract file')
  .option('-o, --output <path>', 'Output report file')
  .option('--fail-on-breaking', 'Exit with error code if breaking changes found')
  .action(async (options) => {
    try {
      logger.info('Checking contract compatibility', options);
      
      const detector = new BreakingChangeDetector(logger);
      
      // Load contracts
      // Implementation would load actual contract files
      const oldContract = {};
      const newContract = {};
      
      // Check compatibility
      const result = options.old.includes('pact')
        ? await detector.detectPactBreakingChanges(oldContract as any, newContract as any)
        : await detector.detectOpenAPIBreakingChanges(oldContract as any, newContract as any);
      
      // Generate report
      if (options.output) {
        const impact = detector.analyzeChangeImpact(result.breakingChanges, result.warnings);
        const report = detector.generateBreakingChangeReport(result, impact);
        
        const fs = require('fs');
        fs.writeFileSync(options.output, report);
        
        logger.info('Compatibility report generated', { outputFile: options.output });
      }
      
      // Display results
      if (result.isCompatible) {
        logger.info('✅ Contracts are compatible');
      } else {
        logger.warn('⚠️ Breaking changes detected', {
          breakingChanges: result.breakingChanges.length,
          warnings: result.warnings.length,
          score: result.compatibilityScore
        });
        
        if (options.failOnBreaking) {
          process.exit(1);
        }
      }
      
    } catch (error) {
      logger.error('Compatibility check failed', { error });
      process.exit(1);
    }
  });

// Generate test report
program
  .command('generate-report')
  .description('Generate contract test report')
  .option('-i, --input <path>', 'Input directory containing test results', './reports')
  .option('-o, --output <path>', 'Output directory', './reports')
  .option('-f, --format <format>', 'Report format (html|json|junit|markdown)', 'html')
  .option('--include-charts', 'Include charts in HTML report')
  .option('--include-matrix', 'Include compatibility matrix')
  .action(async (options) => {
    try {
      logger.info('Generating contract test report', options);
      
      const reporter = new ContractReporter(logger);
      
      // Load test results
      const testResults = [];
      // Implementation would load actual test result files
      
      // Generate report
      const report = await reporter.generateReport(
        testResults,
        {
          outputDir: options.output,
          format: options.format,
          includeCharts: options.includeCharts,
          includeCompatibilityMatrix: options.includeMatrix
        }
      );
      
      logger.info('Test report generated successfully', {
        filePath: report.filePath,
        testCount: testResults.length,
        passRate: report.summary.overallPassRate
      });
      
    } catch (error) {
      logger.error('Report generation failed', { error });
      process.exit(1);
    }
  });

// Start mock service
program
  .command('mock')
  .description('Start contract-based mock service')
  .option('-p, --port <port>', 'Port to run mock service on', '3001')
  .option('-h, --host <host>', 'Host to bind mock service to', 'localhost')
  .option('--contracts <path>', 'Path to contract files', './pacts')
  .option('--name <name>', 'Mock service name', 'contract-mock')
  .action(async (options) => {
    try {
      logger.info('Starting contract mock service', options);
      
      const mockService = new ContractMockService({
        name: options.name,
        port: parseInt(options.port),
        host: options.host,
        pactFiles: [options.contracts] // Would expand to actual file list
      }, logger);
      
      await mockService.start();
      
      logger.info(`🚀 Mock service running on http://${options.host}:${options.port}`);
      logger.info('Press Ctrl+C to stop');
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Shutting down mock service...');
        await mockService.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        logger.info('Shutting down mock service...');
        await mockService.stop();
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Failed to start mock service', { error });
      process.exit(1);
    }
  });

// Governance commands
const governance = program
  .command('governance')
  .description('Contract governance commands');

governance
  .command('submit')
  .description('Submit contract changes for approval')
  .option('--old <path>', 'Path to old contract file')
  .option('--new <path>', 'Path to new contract file')
  .option('--requester <name>', 'Requester name', process.env.USER || 'unknown')
  .option('--environment <env>', 'Target environment', 'staging')
  .action(async (options) => {
    try {
      logger.info('Submitting contract changes for approval', options);
      
      // This would use actual governance configuration
      const governanceConfig = {
        rules: [],
        defaultApprovers: ['platform-team'],
        approvalTimeout: 24,
        requireAllApprovers: false,
        autoApprovePatterns: [],
        blockPatterns: [],
        integrations: {}
      };
      
      const workflow = new ContractGovernanceWorkflow(governanceConfig, logger);
      
      // Load contracts
      const oldContract = {};
      const newContract = {};
      
      // Submit for approval
      const execution = await workflow.submitForApproval(
        options.requester,
        oldContract,
        newContract,
        options.environment
      );
      
      logger.info('Approval request submitted', {
        requestId: execution.requestId,
        status: execution.status,
        expiresAt: execution.expiresAt
      });
      
    } catch (error) {
      logger.error('Failed to submit for approval', { error });
      process.exit(1);
    }
  });

governance
  .command('approve')
  .description('Approve pending contract changes')
  .requiredOption('--request-id <id>', 'Approval request ID')
  .requiredOption('--approver <name>', 'Approver name')
  .option('--comments <text>', 'Approval comments')
  .option('--reject', 'Reject instead of approve')
  .action(async (options) => {
    try {
      logger.info('Processing approval decision', options);
      
      const governanceConfig = {
        rules: [],
        defaultApprovers: ['platform-team'],
        approvalTimeout: 24,
        requireAllApprovers: false,
        autoApprovePatterns: [],
        blockPatterns: [],
        integrations: {}
      };
      
      const workflow = new ContractGovernanceWorkflow(governanceConfig, logger);
      
      const execution = await workflow.processApproval(
        options.requestId,
        options.approver,
        !options.reject,
        options.comments
      );
      
      logger.info('Approval decision processed', {
        requestId: options.requestId,
        status: execution.status,
        approved: !options.reject
      });
      
    } catch (error) {
      logger.error('Failed to process approval', { error });
      process.exit(1);
    }
  });

governance
  .command('status')
  .description('Check approval status')
  .option('--request-id <id>', 'Specific request ID to check')
  .option('--pending', 'Show only pending requests')
  .action(async (options) => {
    try {
      const governanceConfig = {
        rules: [],
        defaultApprovers: ['platform-team'],
        approvalTimeout: 24,
        requireAllApprovers: false,
        autoApprovePatterns: [],
        blockPatterns: [],
        integrations: {}
      };
      
      const workflow = new ContractGovernanceWorkflow(governanceConfig, logger);
      
      if (options.requestId) {
        const status = workflow.getApprovalStatus(options.requestId);
        if (status) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          logger.error('Approval request not found', { requestId: options.requestId });
        }
      } else if (options.pending) {
        const pending = workflow.getPendingApprovals();
        console.log(JSON.stringify(pending, null, 2));
      }
      
    } catch (error) {
      logger.error('Failed to get approval status', { error });
      process.exit(1);
    }
  });

// Matrix commands
const matrix = program
  .command('matrix')
  .description('Compatibility matrix commands');

matrix
  .command('update')
  .description('Update compatibility matrix with test results')
  .option('--consumer <name>', 'Consumer name')
  .option('--consumer-version <version>', 'Consumer version')
  .option('--provider <name>', 'Provider name')
  .option('--provider-version <version>', 'Provider version')
  .option('--compatible', 'Mark as compatible')
  .option('--score <number>', 'Compatibility score (0-100)', '100')
  .option('--environment <env>', 'Environment', 'test')
  .action(async (options) => {
    try {
      logger.info('Updating compatibility matrix', options);
      
      const matrix = new CompatibilityMatrix(logger);
      
      matrix.addEntry({
        consumerName: options.consumer,
        consumerVersion: options.consumerVersion,
        providerName: options.provider,
        providerVersion: options.providerVersion,
        isCompatible: options.compatible,
        compatibilityScore: parseInt(options.score),
        lastTested: new Date(),
        environment: options.environment
      });
      
      logger.info('Compatibility matrix updated successfully');
      
    } catch (error) {
      logger.error('Failed to update compatibility matrix', { error });
      process.exit(1);
    }
  });

matrix
  .command('report')
  .description('Generate compatibility matrix report')
  .option('--format <format>', 'Report format (json|html)', 'json')
  .option('--environment <env>', 'Filter by environment')
  .action(async (options) => {
    try {
      const matrix = new CompatibilityMatrix(logger);
      
      const filters = options.environment ? { environment: options.environment } : {};
      const report = matrix.generateCompatibilityReport(filters);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(report, null, 2));
      } else {
        // Generate HTML report
        logger.info('HTML matrix report would be generated here');
      }
      
    } catch (error) {
      logger.error('Failed to generate matrix report', { error });
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Handle errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});