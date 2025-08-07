/**
 * CI/CD Template Generators
 * Generates production-ready CI/CD pipeline templates
 */

import { CICDTemplateConfig, GeneratedTemplate, TemplateMetadata } from '../';
import { GitHubActionsGenerator } from './github-actions';
import { GitLabCIGenerator } from './gitlab-ci';
import { JenkinsGenerator } from './jenkins';
import { AzureDevOpsGenerator } from './azure-devops';
import { TektonGenerator } from './tekton';
import { CircleCIGenerator } from './circleci';

export interface TemplateGenerator {
  generate(config: CICDTemplateConfig): GeneratedTemplate;
  validate(config: CICDTemplateConfig): boolean;
  getMetadata(): TemplateMetadata;
}

/**
 * Factory for creating CI/CD template generators
 */
export class TemplateGeneratorFactory {
  private static generators = new Map<string, new() => TemplateGenerator>([
    ['github-actions', GitHubActionsGenerator],
    ['gitlab-ci', GitLabCIGenerator],
    ['jenkins', JenkinsGenerator],
    ['azure-devops', AzureDevOpsGenerator],
    ['tekton', TektonGenerator],
    ['circleci', CircleCIGenerator],
  ]);
  
  static create(platform: string): TemplateGenerator {
    const GeneratorClass = this.generators.get(platform);
    
    if (!GeneratorClass) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    return new GeneratorClass();
  }
  
  static registerGenerator(
    platform: string, 
    generator: new() => TemplateGenerator
  ): void {
    this.generators.set(platform, generator);
  }
  
  static listPlatforms(): string[] {
    return Array.from(this.generators.keys());
  }
}

/**
 * Base template generator with common functionality
 */
export abstract class BaseTemplateGenerator implements TemplateGenerator {
  abstract generate(config: CICDTemplateConfig): GeneratedTemplate;
  abstract getMetadata(): TemplateMetadata;
  
  validate(config: CICDTemplateConfig): boolean {
    // Basic validation
    if (!config.platform || !config.language || !config.projectType) {
      return false;
    }
    
    // Platform-specific validation
    return this.validatePlatformSpecific(config);
  }
  
  protected abstract validatePlatformSpecific(config: CICDTemplateConfig): boolean;
  
  /**
   * Generate common CI/CD stages
   */
  protected generateCommonStages(config: CICDTemplateConfig): any {
    const stages: any = {};
    
    // Build stage
    stages.build = this.generateBuildStage(config);
    
    // Test stages
    if (config.testingFrameworks && config.testingFrameworks.length > 0) {
      stages.test = this.generateTestStage(config);
    }
    
    // Security scanning
    if (config.securityScanning) {
      stages.security = this.generateSecurityStage(config);
    }
    
    // Quality gates
    if (config.qualityGates) {
      stages.quality = this.generateQualityStage(config);
    }
    
    // Deploy stages
    if (config.environments && config.environments.length > 0) {
      stages.deploy = this.generateDeployStages(config);
    }
    
    return stages;
  }
  
  protected generateBuildStage(config: CICDTemplateConfig): any {
    const stage: any = {
      name: 'Build',
      steps: []
    };
    
    // Language-specific build steps
    switch (config.language) {
      case 'nodejs':
      case 'typescript':
      case 'react':
        stage.steps.push(
          { name: 'Install dependencies', command: 'npm ci' },
          { name: 'Build', command: 'npm run build' }
        );
        break;
      case 'python':
        stage.steps.push(
          { name: 'Install dependencies', command: 'pip install -r requirements.txt' },
          { name: 'Build', command: 'python setup.py build' }
        );
        break;
      case 'java':
        stage.steps.push(
          { name: 'Build with Maven', command: 'mvn clean package' }
        );
        break;
      case 'golang':
        stage.steps.push(
          { name: 'Download modules', command: 'go mod download' },
          { name: 'Build', command: 'go build -o app' }
        );
        break;
      case 'dotnet':
        stage.steps.push(
          { name: 'Restore packages', command: 'dotnet restore' },
          { name: 'Build', command: 'dotnet build --configuration Release' }
        );
        break;
      case 'rust':
        stage.steps.push(
          { name: 'Build', command: 'cargo build --release' }
        );
        break;
      case 'ruby':
        stage.steps.push(
          { name: 'Install dependencies', command: 'bundle install' },
          { name: 'Build', command: 'bundle exec rake build' }
        );
        break;
      case 'php':
        stage.steps.push(
          { name: 'Install dependencies', command: 'composer install' },
          { name: 'Build', command: 'composer build' }
        );
        break;
    }
    
    // Docker build if enabled
    if (config.dockerEnabled) {
      stage.steps.push({
        name: 'Build Docker image',
        command: 'docker build -t ${IMAGE_NAME}:${VERSION} .'
      });
    }
    
    return stage;
  }
  
  protected generateTestStage(config: CICDTemplateConfig): any {
    const stage: any = {
      name: 'Test',
      parallel: true,
      jobs: []
    };
    
    // Unit tests
    stage.jobs.push({
      name: 'Unit Tests',
      steps: this.getTestCommands(config.language, 'unit')
    });
    
    // Integration tests
    stage.jobs.push({
      name: 'Integration Tests',
      steps: this.getTestCommands(config.language, 'integration')
    });
    
    // E2E tests for frontend projects
    if (config.projectType === 'frontend') {
      stage.jobs.push({
        name: 'E2E Tests',
        steps: this.getTestCommands(config.language, 'e2e')
      });
    }
    
    // Coverage reporting
    if (config.coverageThreshold) {
      stage.jobs.push({
        name: 'Coverage Report',
        steps: [
          { name: 'Generate coverage', command: this.getCoverageCommand(config.language) },
          { name: 'Check threshold', command: `coverage check --min ${config.coverageThreshold}` }
        ]
      });
    }
    
    return stage;
  }
  
  protected generateSecurityStage(config: CICDTemplateConfig): any {
    const stage: any = {
      name: 'Security Scan',
      parallel: true,
      jobs: []
    };
    
    // SAST (Static Application Security Testing)
    stage.jobs.push({
      name: 'SAST',
      steps: [
        { name: 'Run SAST scan', command: 'security-scan sast' }
      ]
    });
    
    // Dependency scanning
    stage.jobs.push({
      name: 'Dependency Scan',
      steps: [
        { name: 'Check dependencies', command: this.getDependencyScanCommand(config.language) }
      ]
    });
    
    // Container scanning if Docker is enabled
    if (config.dockerEnabled) {
      stage.jobs.push({
        name: 'Container Scan',
        steps: [
          { name: 'Scan Docker image', command: 'trivy image ${IMAGE_NAME}:${VERSION}' }
        ]
      });
    }
    
    // License compliance
    stage.jobs.push({
      name: 'License Check',
      steps: [
        { name: 'Check licenses', command: 'license-checker --fail-on GPL' }
      ]
    });
    
    return stage;
  }
  
  protected generateQualityStage(config: CICDTemplateConfig): any {
    const stage: any = {
      name: 'Quality Gates',
      steps: []
    };
    
    const gates = config.qualityGates!;
    
    // Code coverage gate
    if (gates.codeCoverage) {
      stage.steps.push({
        name: 'Check code coverage',
        command: `quality-gate coverage --min ${gates.codeCoverage}`
      });
    }
    
    // Duplicate code gate
    if (gates.duplicateCode) {
      stage.steps.push({
        name: 'Check duplicate code',
        command: `quality-gate duplicates --max ${gates.duplicateCode}`
      });
    }
    
    // Complexity gate
    if (gates.complexity) {
      stage.steps.push({
        name: 'Check complexity',
        command: `quality-gate complexity --max ${gates.complexity}`
      });
    }
    
    // SonarQube analysis if enabled
    if (config.integrations?.sonarqube) {
      stage.steps.push({
        name: 'SonarQube analysis',
        command: 'sonar-scanner'
      });
    }
    
    return stage;
  }
  
  protected generateDeployStages(config: CICDTemplateConfig): any {
    const stages: any[] = [];
    
    for (const env of config.environments!) {
      const stage: any = {
        name: `Deploy to ${env.name}`,
        environment: env.name,
        steps: []
      };
      
      // Pre-deployment checks
      if (env.healthChecks && env.healthChecks.length > 0) {
        stage.steps.push({
          name: 'Pre-deployment health check',
          command: 'health-check pre-deploy'
        });
      }
      
      // Approval step if required
      if (env.approvalRequired) {
        stage.approval = {
          type: 'manual',
          approvers: ['team-leads', 'devops']
        };
      }
      
      // Deployment based on strategy
      stage.steps.push(
        ...this.getDeploymentSteps(config.deploymentStrategy || 'rolling', env)
      );
      
      // Post-deployment validation
      stage.steps.push({
        name: 'Post-deployment validation',
        command: 'validate-deployment'
      });
      
      // Smoke tests
      stage.steps.push({
        name: 'Run smoke tests',
        command: `smoke-test --url ${env.url}`
      });
      
      stages.push(stage);
    }
    
    return stages;
  }
  
  protected getTestCommands(language: string, testType: string): any[] {
    const commands: any[] = [];
    
    switch (language) {
      case 'nodejs':
      case 'typescript':
      case 'react':
        commands.push({ 
          name: `Run ${testType} tests`, 
          command: `npm run test:${testType}` 
        });
        break;
      case 'python':
        commands.push({ 
          name: `Run ${testType} tests`, 
          command: `pytest tests/${testType}` 
        });
        break;
      case 'java':
        commands.push({ 
          name: `Run ${testType} tests`, 
          command: `mvn test -Dtest.type=${testType}` 
        });
        break;
      case 'golang':
        commands.push({ 
          name: `Run ${testType} tests`, 
          command: `go test ./... -tags=${testType}` 
        });
        break;
      case 'dotnet':
        commands.push({ 
          name: `Run ${testType} tests`, 
          command: `dotnet test --filter Category=${testType}` 
        });
        break;
      case 'rust':
        commands.push({ 
          name: `Run ${testType} tests`, 
          command: `cargo test --test ${testType}` 
        });
        break;
    }
    
    return commands;
  }
  
  protected getCoverageCommand(language: string): string {
    switch (language) {
      case 'nodejs':
      case 'typescript':
      case 'react':
        return 'npm run test:coverage';
      case 'python':
        return 'pytest --cov=. --cov-report=xml';
      case 'java':
        return 'mvn jacoco:report';
      case 'golang':
        return 'go test -coverprofile=coverage.out ./...';
      case 'dotnet':
        return 'dotnet test /p:CollectCoverage=true';
      case 'rust':
        return 'cargo tarpaulin --out Xml';
      default:
        return 'echo "Coverage not configured"';
    }
  }
  
  protected getDependencyScanCommand(language: string): string {
    switch (language) {
      case 'nodejs':
      case 'typescript':
      case 'react':
        return 'npm audit --audit-level=moderate';
      case 'python':
        return 'safety check --json';
      case 'java':
        return 'mvn dependency-check:check';
      case 'golang':
        return 'nancy sleuth';
      case 'dotnet':
        return 'dotnet list package --vulnerable';
      case 'rust':
        return 'cargo audit';
      case 'ruby':
        return 'bundle audit check';
      case 'php':
        return 'composer audit';
      default:
        return 'echo "Dependency scan not configured"';
    }
  }
  
  protected getDeploymentSteps(strategy: string, env: any): any[] {
    const steps: any[] = [];
    
    switch (strategy) {
      case 'blue-green':
        steps.push(
          { name: 'Deploy to green environment', command: 'deploy green' },
          { name: 'Run health checks', command: 'health-check green' },
          { name: 'Switch traffic to green', command: 'switch-traffic green' },
          { name: 'Monitor metrics', command: 'monitor --duration 5m' },
          { name: 'Cleanup blue environment', command: 'cleanup blue' }
        );
        break;
        
      case 'canary':
        steps.push(
          { name: 'Deploy canary (10%)', command: 'deploy canary --weight 10' },
          { name: 'Monitor canary metrics', command: 'monitor canary --duration 5m' },
          { name: 'Increase canary (50%)', command: 'deploy canary --weight 50' },
          { name: 'Monitor metrics', command: 'monitor canary --duration 10m' },
          { name: 'Full deployment', command: 'deploy canary --weight 100' },
          { name: 'Cleanup old version', command: 'cleanup previous' }
        );
        break;
        
      case 'progressive':
        steps.push(
          { name: 'Deploy to subset', command: 'deploy progressive --percentage 5' },
          { name: 'Monitor and analyze', command: 'analyze-deployment' },
          { name: 'Progressive rollout', command: 'deploy progressive --auto' },
          { name: 'Full deployment', command: 'deploy complete' }
        );
        break;
        
      case 'feature-flags':
        steps.push(
          { name: 'Deploy with flags disabled', command: 'deploy --flags-disabled' },
          { name: 'Enable flags for test users', command: 'feature-flag enable --users test' },
          { name: 'Progressive flag rollout', command: 'feature-flag rollout --progressive' },
          { name: 'Enable for all users', command: 'feature-flag enable --all' }
        );
        break;
        
      default: // rolling
        steps.push(
          { name: 'Start rolling deployment', command: 'kubectl rollout' },
          { name: 'Monitor rollout status', command: 'kubectl rollout status' },
          { name: 'Verify deployment', command: 'kubectl get pods' }
        );
    }
    
    return steps;
  }
}

export * from './github-actions';
export * from './gitlab-ci';
export * from './jenkins';
export * from './azure-devops';
export * from './tekton';
export * from './circleci';