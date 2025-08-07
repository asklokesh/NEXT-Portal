import { PipelineIntegrationConfig, ContractTestResult, CompatibilityResult } from '../types';
import { PactManager } from '../core/pact-manager';
import { ProviderVerifier } from '../provider/verifier';
import { BreakingChangeDetector } from '../breaking-changes/detector';
import { ContractReporter } from '../reporting/contract-reporter';
import { Logger } from 'winston';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface PipelineStageConfig {
  name: string;
  enabled: boolean;
  failOnError?: boolean;
  timeout?: number;
  retries?: number;
  parallel?: boolean;
}

export interface ContractPipelineConfig {
  stages: {
    contractGeneration: PipelineStageConfig;
    providerVerification: PipelineStageConfig;
    compatibilityCheck: PipelineStageConfig;
    breakingChangeDetection: PipelineStageConfig;
    reporting: PipelineStageConfig;
    publishing: PipelineStageConfig;
  };
  notifications: PipelineIntegrationConfig['notifications'];
  artifacts: {
    contractsPath: string;
    reportsPath: string;
    publishToS3?: {
      bucket: string;
      prefix: string;
    };
    publishToBroker?: {
      url: string;
      token?: string;
    };
  };
  quality_gates: {
    minPassRate: number;
    maxBreakingChanges: number;
    maxCriticalIssues: number;
  };
}

export interface PipelineResult {
  success: boolean;
  stages: {
    [stageName: string]: {
      status: 'success' | 'failed' | 'skipped';
      duration: number;
      output?: any;
      error?: string;
    };
  };
  summary: {
    totalDuration: number;
    passedStages: number;
    failedStages: number;
    artifacts: string[];
  };
  qualityGatesPassed: boolean;
}

export class ContractPipelineIntegrator {
  private logger: Logger;
  private pactManager: PactManager;
  private providerVerifier: ProviderVerifier;
  private breakingChangeDetector: BreakingChangeDetector;
  private reporter: ContractReporter;

  constructor(logger: Logger) {
    this.logger = logger;
    this.pactManager = new PactManager({ logLevel: 'info' }, logger);
    this.providerVerifier = new ProviderVerifier(logger);
    this.breakingChangeDetector = new BreakingChangeDetector(logger);
    this.reporter = new ContractReporter(logger);
  }

  /**
   * Execute complete contract testing pipeline
   */
  async executePipeline(config: ContractPipelineConfig): Promise<PipelineResult> {
    const startTime = Date.now();
    const result: PipelineResult = {
      success: true,
      stages: {},
      summary: {
        totalDuration: 0,
        passedStages: 0,
        failedStages: 0,
        artifacts: []
      },
      qualityGatesPassed: false
    };

    this.logger.info('Starting contract testing pipeline', {
      stages: Object.keys(config.stages).filter(stage => config.stages[stage as keyof typeof config.stages].enabled)
    });

    try {
      // Stage 1: Contract Generation
      if (config.stages.contractGeneration.enabled) {
        result.stages.contractGeneration = await this.executeStage(
          'Contract Generation',
          () => this.generateContracts(config),
          config.stages.contractGeneration
        );
      }

      // Stage 2: Provider Verification
      if (config.stages.providerVerification.enabled && result.stages.contractGeneration?.status === 'success') {
        result.stages.providerVerification = await this.executeStage(
          'Provider Verification',
          () => this.verifyProviders(config),
          config.stages.providerVerification
        );
      }

      // Stage 3: Compatibility Check
      if (config.stages.compatibilityCheck.enabled) {
        result.stages.compatibilityCheck = await this.executeStage(
          'Compatibility Check',
          () => this.checkCompatibility(config),
          config.stages.compatibilityCheck
        );
      }

      // Stage 4: Breaking Change Detection
      if (config.stages.breakingChangeDetection.enabled) {
        result.stages.breakingChangeDetection = await this.executeStage(
          'Breaking Change Detection',
          () => this.detectBreakingChanges(config),
          config.stages.breakingChangeDetection
        );
      }

      // Stage 5: Reporting
      if (config.stages.reporting.enabled) {
        result.stages.reporting = await this.executeStage(
          'Report Generation',
          () => this.generateReports(config, result),
          config.stages.reporting
        );
      }

      // Stage 6: Publishing
      if (config.stages.publishing.enabled && this.shouldPublish(result)) {
        result.stages.publishing = await this.executeStage(
          'Artifact Publishing',
          () => this.publishArtifacts(config),
          config.stages.publishing
        );
      }

      // Calculate summary
      const stages = Object.values(result.stages);
      result.summary.passedStages = stages.filter(s => s.status === 'success').length;
      result.summary.failedStages = stages.filter(s => s.status === 'failed').length;
      result.summary.totalDuration = Date.now() - startTime;

      // Check quality gates
      result.qualityGatesPassed = await this.checkQualityGates(config, result);

      // Determine overall success
      result.success = result.summary.failedStages === 0 && result.qualityGatesPassed;

      // Send notifications
      await this.sendNotifications(config, result);

    } catch (error) {
      this.logger.error('Pipeline execution failed', { error });
      result.success = false;
    }

    this.logger.info('Contract testing pipeline completed', {
      success: result.success,
      duration: result.summary.totalDuration,
      qualityGatesPassed: result.qualityGatesPassed
    });

    return result;
  }

  /**
   * Generate GitHub Actions workflow
   */
  generateGitHubActionsWorkflow(config: ContractPipelineConfig): string {
    const workflow = {
      name: 'Contract Testing',
      on: {
        push: { branches: ['main', 'develop'] },
        pull_request: { branches: ['main'] }
      },
      jobs: {
        'contract-tests': {
          'runs-on': 'ubuntu-latest',
          timeout: 30,
          steps: [
            {
              uses: 'actions/checkout@v4'
            },
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v4',
              with: {
                'node-version': '18',
                'cache': 'npm'
              }
            },
            {
              name: 'Install dependencies',
              run: 'npm ci'
            }
          ]
        }
      }
    };

    // Add contract generation step
    if (config.stages.contractGeneration.enabled) {
      workflow.jobs['contract-tests'].steps.push({
        name: 'Generate Contracts',
        run: 'npm run test:contracts',
        env: {
          CI: 'true',
          NODE_ENV: 'test'
        }
      });
    }

    // Add provider verification step
    if (config.stages.providerVerification.enabled) {
      workflow.jobs['contract-tests'].steps.push({
        name: 'Verify Providers',
        run: 'npm run test:provider-verification',
        env: {
          PROVIDER_BASE_URL: '${{ secrets.PROVIDER_BASE_URL }}',
          CI: 'true'
        }
      });
    }

    // Add compatibility check step
    if (config.stages.compatibilityCheck.enabled) {
      workflow.jobs['contract-tests'].steps.push({
        name: 'Check Compatibility',
        run: 'npm run test:compatibility',
        continue_on_error: !config.stages.compatibilityCheck.failOnError
      });
    }

    // Add artifact upload
    workflow.jobs['contract-tests'].steps.push(
      {
        name: 'Upload Contract Artifacts',
        uses: 'actions/upload-artifact@v3',
        if: 'always()',
        with: {
          name: 'contract-artifacts',
          path: `${config.artifacts.contractsPath}/**/*`,
          'retention-days': 30
        }
      },
      {
        name: 'Upload Test Reports',
        uses: 'actions/upload-artifact@v3',
        if: 'always()',
        with: {
          name: 'contract-reports',
          path: `${config.artifacts.reportsPath}/**/*`,
          'retention-days': 30
        }
      }
    );

    // Add Pact Broker publishing
    if (config.artifacts.publishToBroker) {
      workflow.jobs['contract-tests'].steps.push({
        name: 'Publish to Pact Broker',
        run: 'npx pact-broker publish pacts --consumer-app-version ${{ github.sha }} --broker-base-url ${{ secrets.PACT_BROKER_BASE_URL }} --broker-token ${{ secrets.PACT_BROKER_TOKEN }}',
        if: "success() && github.ref == 'refs/heads/main'"
      });
    }

    return `# Generated Contract Testing Workflow\n${this.convertToYAML(workflow)}`;
  }

  /**
   * Generate GitLab CI configuration
   */
  generateGitLabCIConfig(config: ContractPipelineConfig): string {
    const gitlabConfig = {
      stages: ['test', 'verify', 'publish'],
      variables: {
        NODE_VERSION: '18'
      },
      before_script: [
        'node --version',
        'npm --version',
        'npm ci'
      ],
      'contract-generation': {
        stage: 'test',
        script: ['npm run test:contracts'],
        artifacts: {
          paths: [config.artifacts.contractsPath],
          expire_in: '1 week',
          reports: {
            junit: 'reports/junit.xml'
          }
        },
        only: config.stages.contractGeneration.enabled ? ['main', 'develop', 'merge_requests'] : []
      },
      'provider-verification': {
        stage: 'verify',
        script: ['npm run test:provider-verification'],
        dependencies: ['contract-generation'],
        artifacts: {
          paths: [config.artifacts.reportsPath],
          expire_in: '1 week'
        },
        only: config.stages.providerVerification.enabled ? ['main', 'develop'] : []
      },
      'publish-contracts': {
        stage: 'publish',
        script: [
          'npx pact-broker publish pacts --consumer-app-version $CI_COMMIT_SHA --broker-base-url $PACT_BROKER_BASE_URL --broker-token $PACT_BROKER_TOKEN'
        ],
        dependencies: ['provider-verification'],
        only: ['main']
      }
    };

    return `# Generated GitLab CI Configuration\n${this.convertToYAML(gitlabConfig)}`;
  }

  /**
   * Generate Jenkins pipeline
   */
  generateJenkinsPipeline(config: ContractPipelineConfig): string {
    return `
pipeline {
    agent any
    
    tools {
        nodejs '18'
    }
    
    environment {
        CI = 'true'
        NODE_ENV = 'test'
        PACT_BROKER_BASE_URL = credentials('pact-broker-url')
        PACT_BROKER_TOKEN = credentials('pact-broker-token')
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
            }
        }
        
        ${config.stages.contractGeneration.enabled ? `
        stage('Generate Contracts') {
            steps {
                sh 'npm run test:contracts'
            }
            post {
                always {
                    archiveArtifacts artifacts: '${config.artifacts.contractsPath}/**/*', fingerprint: true
                    publishTestResults testResultsPattern: 'reports/junit.xml'
                }
            }
        }
        ` : ''}
        
        ${config.stages.providerVerification.enabled ? `
        stage('Verify Providers') {
            steps {
                sh 'npm run test:provider-verification'
            }
            post {
                always {
                    archiveArtifacts artifacts: '${config.artifacts.reportsPath}/**/*', fingerprint: true
                }
            }
        }
        ` : ''}
        
        ${config.stages.publishing.enabled ? `
        stage('Publish Contracts') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    npx pact-broker publish pacts \\
                        --consumer-app-version $BUILD_NUMBER \\
                        --broker-base-url $PACT_BROKER_BASE_URL \\
                        --broker-token $PACT_BROKER_TOKEN
                '''
            }
        }
        ` : ''}
    }
    
    post {
        always {
            cleanWs()
        }
        failure {
            emailext (
                subject: "Contract Tests Failed: \${env.JOB_NAME} - \${env.BUILD_NUMBER}",
                body: "Contract testing pipeline failed. Please check the build logs.",
                to: "${config.notifications?.email?.recipients?.join(', ') || ''}"
            )
        }
    }
}`;
  }

  private async executeStage(
    stageName: string,
    stageFunction: () => Promise<any>,
    stageConfig: PipelineStageConfig
  ): Promise<{ status: 'success' | 'failed' | 'skipped'; duration: number; output?: any; error?: string }> {
    const startTime = Date.now();

    if (!stageConfig.enabled) {
      return {
        status: 'skipped',
        duration: 0
      };
    }

    this.logger.info(`Executing pipeline stage: ${stageName}`);

    try {
      // Set timeout if configured
      const timeoutPromise = stageConfig.timeout 
        ? new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Stage timeout')), stageConfig.timeout)
          )
        : null;

      const stagePromise = stageFunction();
      const output = timeoutPromise 
        ? await Promise.race([stagePromise, timeoutPromise])
        : await stagePromise;

      const duration = Date.now() - startTime;
      
      this.logger.info(`Pipeline stage completed: ${stageName}`, { duration });
      
      return {
        status: 'success',
        duration,
        output
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(`Pipeline stage failed: ${stageName}`, { error: errorMessage, duration });
      
      return {
        status: 'failed',
        duration,
        error: errorMessage
      };
    }
  }

  private async generateContracts(config: ContractPipelineConfig): Promise<string[]> {
    // This would run consumer tests to generate Pact contracts
    try {
      const { stdout } = await execAsync('npm run test:contracts');
      this.logger.debug('Contract generation output', { stdout });
      
      // Return list of generated contract files
      return ['consumer1-provider1.json', 'consumer2-provider2.json'];
    } catch (error) {
      throw new Error(`Contract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async verifyProviders(config: ContractPipelineConfig): Promise<ContractTestResult[]> {
    // This would run provider verification tests
    try {
      const { stdout } = await execAsync('npm run test:provider-verification');
      this.logger.debug('Provider verification output', { stdout });
      
      // Return test results (would parse actual results)
      return [];
    } catch (error) {
      throw new Error(`Provider verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkCompatibility(config: ContractPipelineConfig): Promise<CompatibilityResult[]> {
    // This would run compatibility checks between contract versions
    try {
      const { stdout } = await execAsync('npm run test:compatibility');
      this.logger.debug('Compatibility check output', { stdout });
      
      // Return compatibility results (would parse actual results)
      return [];
    } catch (error) {
      throw new Error(`Compatibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async detectBreakingChanges(config: ContractPipelineConfig): Promise<CompatibilityResult[]> {
    // This would detect breaking changes between contract versions
    try {
      // Implementation would load old and new contracts and compare them
      return [];
    } catch (error) {
      throw new Error(`Breaking change detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateReports(config: ContractPipelineConfig, pipelineResult: PipelineResult): Promise<string[]> {
    try {
      // Generate various report formats
      const reports: string[] = [];
      
      // HTML Report
      if (pipelineResult.stages.providerVerification?.output) {
        const htmlReport = await this.reporter.generateReport(
          pipelineResult.stages.providerVerification.output,
          {
            outputDir: config.artifacts.reportsPath,
            format: 'html',
            includeCharts: true,
            includeCompatibilityMatrix: true
          }
        );
        reports.push(htmlReport.filePath!);
      }
      
      // JUnit Report for CI integration
      if (pipelineResult.stages.providerVerification?.output) {
        const junitReport = await this.reporter.generateReport(
          pipelineResult.stages.providerVerification.output,
          {
            outputDir: config.artifacts.reportsPath,
            format: 'junit'
          }
        );
        reports.push(junitReport.filePath!);
      }
      
      return reports;
    } catch (error) {
      throw new Error(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async publishArtifacts(config: ContractPipelineConfig): Promise<string[]> {
    const published: string[] = [];

    try {
      // Publish to Pact Broker if configured
      if (config.artifacts.publishToBroker) {
        await this.publishToPactBroker(config);
        published.push('pact-broker');
      }

      // Publish to S3 if configured
      if (config.artifacts.publishToS3) {
        await this.publishToS3(config);
        published.push('s3');
      }

      return published;
    } catch (error) {
      throw new Error(`Artifact publishing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async publishToPactBroker(config: ContractPipelineConfig): Promise<void> {
    const { url, token } = config.artifacts.publishToBroker!;
    const version = process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA || 'latest';
    
    const command = `npx pact-broker publish ${config.artifacts.contractsPath} --consumer-app-version ${version} --broker-base-url ${url}${token ? ` --broker-token ${token}` : ''}`;
    
    try {
      const { stdout } = await execAsync(command);
      this.logger.info('Published contracts to Pact Broker', { stdout });
    } catch (error) {
      throw new Error(`Pact Broker publishing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async publishToS3(config: ContractPipelineConfig): Promise<void> {
    const { bucket, prefix } = config.artifacts.publishToS3!;
    
    const command = `aws s3 cp ${config.artifacts.contractsPath} s3://${bucket}/${prefix}/ --recursive`;
    
    try {
      const { stdout } = await execAsync(command);
      this.logger.info('Published contracts to S3', { bucket, prefix, stdout });
    } catch (error) {
      throw new Error(`S3 publishing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkQualityGates(config: ContractPipelineConfig, result: PipelineResult): Promise<boolean> {
    let passed = true;
    const issues: string[] = [];

    // Check pass rate
    if (result.stages.providerVerification?.output) {
      const testResults: ContractTestResult[] = result.stages.providerVerification.output;
      const totalTests = testResults.length;
      const passedTests = testResults.filter(r => r.status === 'passed').length;
      const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

      if (passRate < config.quality_gates.minPassRate) {
        passed = false;
        issues.push(`Pass rate ${passRate.toFixed(1)}% is below threshold ${config.quality_gates.minPassRate}%`);
      }
    }

    // Check breaking changes
    if (result.stages.breakingChangeDetection?.output) {
      const compatibilityResults: CompatibilityResult[] = result.stages.breakingChangeDetection.output;
      const breakingChanges = compatibilityResults.reduce((sum, r) => sum + r.breakingChanges.length, 0);

      if (breakingChanges > config.quality_gates.maxBreakingChanges) {
        passed = false;
        issues.push(`Breaking changes ${breakingChanges} exceeds threshold ${config.quality_gates.maxBreakingChanges}`);
      }
    }

    if (!passed) {
      this.logger.warn('Quality gates failed', { issues });
    }

    return passed;
  }

  private shouldPublish(result: PipelineResult): boolean {
    // Only publish if key stages passed
    return (
      result.stages.contractGeneration?.status === 'success' &&
      (result.stages.providerVerification?.status === 'success' || !result.stages.providerVerification) &&
      result.qualityGatesPassed
    );
  }

  private async sendNotifications(config: ContractPipelineConfig, result: PipelineResult): Promise<void> {
    if (!config.notifications) return;

    const message = this.createNotificationMessage(result);

    try {
      // Send Slack notification
      if (config.notifications.slack) {
        await this.sendSlackNotification(config.notifications.slack, message, result.success);
      }

      // Send email notification
      if (config.notifications.email && !result.success) {
        await this.sendEmailNotification(config.notifications.email, message);
      }
    } catch (error) {
      this.logger.error('Failed to send notifications', { error });
    }
  }

  private createNotificationMessage(result: PipelineResult): string {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    const duration = Math.round(result.summary.totalDuration / 1000);
    
    let message = `Contract Testing Pipeline ${status}\n`;
    message += `Duration: ${duration}s\n`;
    message += `Stages: ${result.summary.passedStages} passed, ${result.summary.failedStages} failed\n`;
    message += `Quality Gates: ${result.qualityGatesPassed ? 'PASSED' : 'FAILED'}\n`;

    if (result.summary.failedStages > 0) {
      message += '\nFailed Stages:\n';
      Object.entries(result.stages)
        .filter(([_, stage]) => stage.status === 'failed')
        .forEach(([name, stage]) => {
          message += `- ${name}: ${stage.error}\n`;
        });
    }

    return message;
  }

  private async sendSlackNotification(
    slackConfig: { webhook: string; channel: string },
    message: string,
    success: boolean
  ): Promise<void> {
    const payload = {
      channel: slackConfig.channel,
      text: message,
      color: success ? 'good' : 'danger',
      fields: [
        {
          title: 'Pipeline Status',
          value: success ? 'Success' : 'Failed',
          short: true
        }
      ]
    };

    // Would send to Slack webhook
    this.logger.info('Slack notification sent', { channel: slackConfig.channel, success });
  }

  private async sendEmailNotification(
    emailConfig: { recipients: string[]; smtp: any },
    message: string
  ): Promise<void> {
    // Would send email notification
    this.logger.info('Email notification sent', { recipients: emailConfig.recipients });
  }

  private convertToYAML(obj: any): string {
    // Simple YAML conversion - in production use a proper YAML library
    return JSON.stringify(obj, null, 2)
      .replace(/"/g, '')
      .replace(/,/g, '')
      .replace(/{/g, '')
      .replace(/}/g, '')
      .replace(/\[/g, '')
      .replace(/\]/g, '');
  }
}