/**
 * GitHub Actions Template Generator
 * Generates production-ready GitHub Actions workflows
 */

import { CICDTemplateConfig, GeneratedTemplate, TemplateMetadata } from '../';
import { BaseTemplateGenerator } from './index';

export class GitHubActionsGenerator extends BaseTemplateGenerator {
  getMetadata(): TemplateMetadata {
    return {
      name: 'GitHub Actions CI/CD Pipeline',
      version: '2.0.0',
      description: 'Production-ready GitHub Actions workflow with comprehensive CI/CD capabilities',
      author: 'Platform Team',
      tags: ['github-actions', 'ci/cd', 'automation'],
      requiredSecrets: [
        'GITHUB_TOKEN',
        'REGISTRY_USERNAME',
        'REGISTRY_PASSWORD',
        'SONAR_TOKEN',
        'SNYK_TOKEN',
        'SLACK_WEBHOOK'
      ],
      estimatedDuration: 15,
      costEstimate: {
        compute: 0.008, // per minute
        storage: 0.25,  // per GB/month
        network: 0.0    // included
      }
    };
  }
  
  generate(config: CICDTemplateConfig): GeneratedTemplate {
    const metadata = this.getMetadata();
    const files = new Map<string, string>();
    
    // Main workflow file
    const mainWorkflow = this.generateMainWorkflow(config);
    files.set('.github/workflows/ci-cd.yml', mainWorkflow);
    
    // Reusable workflows
    if (config.testingFrameworks && config.testingFrameworks.length > 0) {
      files.set('.github/workflows/tests.yml', this.generateTestWorkflow(config));
    }
    
    if (config.securityScanning) {
      files.set('.github/workflows/security.yml', this.generateSecurityWorkflow(config));
    }
    
    if (config.deploymentStrategy) {
      files.set('.github/workflows/deploy.yml', this.generateDeployWorkflow(config));
    }
    
    // Dependabot configuration
    if (config.dependencyUpdates) {
      files.set('.github/dependabot.yml', this.generateDependabotConfig(config));
    }
    
    // PR template
    files.set('.github/pull_request_template.md', this.generatePRTemplate());
    
    // Issue templates
    files.set('.github/ISSUE_TEMPLATE/bug_report.md', this.generateBugTemplate());
    files.set('.github/ISSUE_TEMPLATE/feature_request.md', this.generateFeatureTemplate());
    
    // Documentation
    const documentation = this.generateDocumentation(config);
    
    return {
      metadata,
      content: mainWorkflow,
      files,
      documentation
    };
  }
  
  protected validatePlatformSpecific(config: CICDTemplateConfig): boolean {
    // GitHub Actions specific validation
    return true;
  }
  
  private generateMainWorkflow(config: CICDTemplateConfig): string {
    const stages = this.generateCommonStages(config);
    
    return `name: CI/CD Pipeline

on:
  push:
    branches: [main, develop, release/*]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * 0' # Weekly security scan
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: false
        default: 'staging'
        type: choice
        options:
          - staging
          - production
          - dr

env:
  NODE_VERSION: '20'
  PYTHON_VERSION: '3.11'
  JAVA_VERSION: '17'
  GO_VERSION: '1.21'
  DOTNET_VERSION: '8.0'
  RUST_VERSION: '1.75'
  ${config.containerRegistry ? `REGISTRY: ${config.containerRegistry}` : 'REGISTRY: ghcr.io'}
  IMAGE_NAME: \${{ github.repository }}

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}

jobs:
  # Initialize job to set up variables and check conditions
  initialize:
    name: Initialize Pipeline
    runs-on: ubuntu-latest
    outputs:
      should-deploy: \${{ steps.check.outputs.should-deploy }}
      version: \${{ steps.version.outputs.version }}
      environment: \${{ steps.env.outputs.environment }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Check deployment conditions
        id: check
        run: |
          if [[ "\${{ github.ref }}" == "refs/heads/main" ]] || [[ "\${{ github.event_name }}" == "workflow_dispatch" ]]; then
            echo "should-deploy=true" >> \$GITHUB_OUTPUT
          else
            echo "should-deploy=false" >> \$GITHUB_OUTPUT
          fi
      
      - name: Generate version
        id: version
        run: |
          VERSION=$(git describe --tags --always --dirty)
          echo "version=\${VERSION}" >> \$GITHUB_OUTPUT
      
      - name: Determine environment
        id: env
        run: |
          if [[ "\${{ github.event_name }}" == "workflow_dispatch" ]]; then
            echo "environment=\${{ github.event.inputs.environment }}" >> \$GITHUB_OUTPUT
          elif [[ "\${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> \$GITHUB_OUTPUT
          elif [[ "\${{ github.ref }}" == "refs/heads/develop" ]]; then
            echo "environment=staging" >> \$GITHUB_OUTPUT
          else
            echo "environment=development" >> \$GITHUB_OUTPUT
          fi

  # Code quality checks
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    needs: initialize
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-${config.language}
        with:
          version: \${{ env.${this.getVersionEnvVar(config.language)} }}
      
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ${this.getCachePath(config.language)}
          key: \${{ runner.os }}-${config.language}-\${{ hashFiles('${this.getLockFile(config.language)}') }}
          restore-keys: |
            \${{ runner.os }}-${config.language}-
      
      - name: Install dependencies
        run: ${this.getInstallCommand(config.language)}
      
      - name: Lint code
        run: ${this.getLintCommand(config.language)}
      
      - name: Check formatting
        run: ${this.getFormatCommand(config.language)}
      
      - name: Type checking
        if: \${{ contains('${config.language}', 'typescript') || contains('${config.language}', 'python') }}
        run: ${this.getTypeCheckCommand(config.language)}
      
      - name: Complexity analysis
        run: |
          echo "Analyzing code complexity..."
          ${this.getComplexityCommand(config.language)}

  # Build job
  build:
    name: Build
    runs-on: \${{ matrix.os }}
    needs: [initialize, quality]
    strategy:
      matrix:
        os: [ubuntu-latest${config.matrixBuilds ? ', windows-latest, macos-latest' : ''}]
        ${this.getMatrixConfig(config)}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup build environment
        uses: ./.github/actions/setup-${config.language}
        with:
          version: \${{ env.${this.getVersionEnvVar(config.language)} }}
      
      - name: Restore cache
        uses: actions/cache@v3
        with:
          path: ${this.getCachePath(config.language)}
          key: \${{ runner.os }}-build-\${{ hashFiles('${this.getLockFile(config.language)}') }}
      
      - name: Install dependencies
        run: ${this.getInstallCommand(config.language)}
      
      - name: Build application
        run: ${this.getBuildCommand(config.language)}
        env:
          VERSION: \${{ needs.initialize.outputs.version }}
      
      - name: Build Docker image
        if: \${{ matrix.os == 'ubuntu-latest' && ${config.dockerEnabled ? 'true' : 'false'} }}
        run: |
          docker build \
            --build-arg VERSION=\${{ needs.initialize.outputs.version }} \
            --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
            --build-arg VCS_REF=\${{ github.sha }} \
            --tag \${{ env.IMAGE_NAME }}:\${{ needs.initialize.outputs.version }} \
            --tag \${{ env.IMAGE_NAME }}:latest \
            .
      
      - name: Save Docker image
        if: \${{ matrix.os == 'ubuntu-latest' && ${config.dockerEnabled ? 'true' : 'false'} }}
        run: |
          docker save \${{ env.IMAGE_NAME }}:\${{ needs.initialize.outputs.version }} | gzip > image.tar.gz
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts-\${{ matrix.os }}
          path: |
            ${this.getBuildArtifacts(config.language)}
            ${config.dockerEnabled ? 'image.tar.gz' : ''}
          retention-days: 7

  # Test jobs
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup test environment
        uses: ./.github/actions/setup-${config.language}
        with:
          version: \${{ env.${this.getVersionEnvVar(config.language)} }}
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts-ubuntu-latest
      
      - name: Run unit tests
        run: ${this.getTestCommand(config.language, 'unit')}
      
      - name: Generate coverage report
        run: ${this.getCoverageCommand(config.language)}
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: unittests
          name: codecov-\${{ github.sha }}
      
      - name: Check coverage threshold
        if: \${{ ${config.coverageThreshold ? 'true' : 'false'} }}
        run: |
          COVERAGE=$(cat coverage.xml | grep -oP 'line-rate="\\K[^"]+' | head -1)
          THRESHOLD=${config.coverageThreshold || 80}
          if (( \$(echo "\$COVERAGE < \$THRESHOLD / 100" | bc -l) )); then
            echo "Coverage \$COVERAGE is below threshold \$THRESHOLD%"
            exit 1
          fi

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: build
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup test environment
        uses: ./.github/actions/setup-${config.language}
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts-ubuntu-latest
      
      - name: Setup test database
        run: |
          ${this.getDBSetupCommand(config.language)}
      
      - name: Run integration tests
        run: ${this.getTestCommand(config.language, 'integration')}
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  ${config.projectType === 'frontend' ? this.generateE2ETestJob(config) : ''}

  # Security scanning
  security:
    name: Security Scanning
    runs-on: ubuntu-latest
    needs: build
    if: \${{ github.event_name != 'pull_request' || github.event.pull_request.draft == false }}
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      ${config.integrations?.snyk ? this.generateSnykScan(config) : ''}
      
      ${config.integrations?.sonarqube ? this.generateSonarQubeScan(config) : ''}
      
      - name: Dependency check
        run: ${this.getDependencyScanCommand(config.language)}
      
      - name: License compliance
        run: |
          ${this.getLicenseCheckCommand(config.language)}

  # Performance testing
  ${config.performanceTesting ? this.generatePerformanceJob(config) : ''}

  # Deploy jobs
  ${config.environments ? this.generateDeployJobs(config) : ''}

  # Notification job
  notify:
    name: Send Notifications
    runs-on: ubuntu-latest
    needs: [build, unit-tests, integration-tests, security]
    if: always()
    steps:
      - name: Determine status
        id: status
        run: |
          if [[ "\${{ needs.build.result }}" == "failure" ]] || \
             [[ "\${{ needs.unit-tests.result }}" == "failure" ]] || \
             [[ "\${{ needs.integration-tests.result }}" == "failure" ]] || \
             [[ "\${{ needs.security.result }}" == "failure" ]]; then
            echo "status=failure" >> \$GITHUB_OUTPUT
          else
            echo "status=success" >> \$GITHUB_OUTPUT
          fi
      
      ${config.integrations?.slack ? this.generateSlackNotification() : ''}
      ${config.integrations?.teams ? this.generateTeamsNotification() : ''}
      ${config.integrations?.jira ? this.generateJiraUpdate() : ''}
`;
  }
  
  private generateTestWorkflow(config: CICDTemplateConfig): string {
    return `name: Reusable Test Workflow

on:
  workflow_call:
    inputs:
      test-type:
        required: true
        type: string
      environment:
        required: false
        type: string
        default: 'test'

jobs:
  test:
    name: Run \${{ inputs.test-type }} Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-${config.language}
      
      - name: Run tests
        run: ${this.getTestCommand(config.language, '${{ inputs.test-type }}')}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-\${{ inputs.test-type }}
          path: test-results/
`;
  }
  
  private generateSecurityWorkflow(config: CICDTemplateConfig): string {
    return `name: Security Scanning Workflow

on:
  workflow_call:
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday

permissions:
  security-events: write
  contents: read

jobs:
  scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: ${this.getCodeQLLanguage(config.language)}
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
      
      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'deps'
          path: '.'
          format: 'HTML'
      
      - name: Upload OWASP results
        uses: actions/upload-artifact@v3
        with:
          name: dependency-check-report
          path: reports/
`;
  }
  
  private generateDeployWorkflow(config: CICDTemplateConfig): string {
    return `name: Deployment Workflow

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      version:
        required: true
        type: string
      strategy:
        required: false
        type: string
        default: '${config.deploymentStrategy || 'rolling'}'

jobs:
  deploy:
    name: Deploy to \${{ inputs.environment }}
    runs-on: ubuntu-latest
    environment:
      name: \${{ inputs.environment }}
      url: \${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure cloud credentials
        uses: ./.github/actions/setup-cloud
        with:
          environment: \${{ inputs.environment }}
      
      - name: Deploy application
        id: deploy
        run: |
          ./scripts/deploy.sh \
            --environment \${{ inputs.environment }} \
            --version \${{ inputs.version }} \
            --strategy \${{ inputs.strategy }}
      
      - name: Run smoke tests
        run: |
          ./scripts/smoke-test.sh --url \${{ steps.deploy.outputs.url }}
      
      - name: Monitor deployment
        run: |
          ./scripts/monitor-deployment.sh \
            --environment \${{ inputs.environment }} \
            --duration 5m
`;
  }
  
  private generateDependabotConfig(config: CICDTemplateConfig): string {
    return `version: 2
updates:
  - package-ecosystem: "${this.getPackageEcosystem(config.language)}"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "00:00"
    open-pull-requests-limit: 10
    reviewers:
      - "platform-team"
    labels:
      - "dependencies"
      - "automated"
    commit-message:
      prefix: "chore"
      include: "scope"
    
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "ci/cd"
      - "automated"
    
  ${config.dockerEnabled ? `- package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "docker"
      - "automated"` : ''}
`;
  }
  
  // Helper methods
  private getVersionEnvVar(language: string): string {
    const envVars: Record<string, string> = {
      'nodejs': 'NODE_VERSION',
      'typescript': 'NODE_VERSION',
      'react': 'NODE_VERSION',
      'python': 'PYTHON_VERSION',
      'java': 'JAVA_VERSION',
      'golang': 'GO_VERSION',
      'dotnet': 'DOTNET_VERSION',
      'rust': 'RUST_VERSION',
      'ruby': 'RUBY_VERSION',
      'php': 'PHP_VERSION'
    };
    return envVars[language] || 'VERSION';
  }
  
  private getCachePath(language: string): string {
    const paths: Record<string, string> = {
      'nodejs': '~/.npm',
      'typescript': '~/.npm',
      'react': '~/.npm',
      'python': '~/.cache/pip',
      'java': '~/.m2',
      'golang': '~/go/pkg/mod',
      'dotnet': '~/.nuget/packages',
      'rust': '~/.cargo',
      'ruby': 'vendor/bundle',
      'php': 'vendor'
    };
    return paths[language] || '.cache';
  }
  
  private getLockFile(language: string): string {
    const files: Record<string, string> = {
      'nodejs': '**/package-lock.json',
      'typescript': '**/package-lock.json',
      'react': '**/package-lock.json',
      'python': '**/requirements*.txt',
      'java': '**/pom.xml',
      'golang': '**/go.sum',
      'dotnet': '**/*.csproj',
      'rust': '**/Cargo.lock',
      'ruby': '**/Gemfile.lock',
      'php': '**/composer.lock'
    };
    return files[language] || '**/lock';
  }
  
  private getInstallCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npm ci',
      'typescript': 'npm ci',
      'react': 'npm ci',
      'python': 'pip install -r requirements.txt',
      'java': 'mvn dependency:resolve',
      'golang': 'go mod download',
      'dotnet': 'dotnet restore',
      'rust': 'cargo fetch',
      'ruby': 'bundle install',
      'php': 'composer install'
    };
    return commands[language] || 'echo "Install dependencies"';
  }
  
  private getBuildCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npm run build',
      'typescript': 'npm run build',
      'react': 'npm run build',
      'python': 'python setup.py build',
      'java': 'mvn clean package',
      'golang': 'go build -o app',
      'dotnet': 'dotnet build --configuration Release',
      'rust': 'cargo build --release',
      'ruby': 'bundle exec rake build',
      'php': 'composer build'
    };
    return commands[language] || 'echo "Build application"';
  }
  
  private getLintCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npm run lint',
      'typescript': 'npm run lint',
      'react': 'npm run lint',
      'python': 'pylint src/',
      'java': 'mvn checkstyle:check',
      'golang': 'golangci-lint run',
      'dotnet': 'dotnet format --verify-no-changes',
      'rust': 'cargo clippy',
      'ruby': 'rubocop',
      'php': 'phpcs'
    };
    return commands[language] || 'echo "Lint code"';
  }
  
  private getFormatCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npm run format:check',
      'typescript': 'npm run format:check',
      'react': 'npm run format:check',
      'python': 'black --check .',
      'java': 'mvn spotless:check',
      'golang': 'gofmt -l .',
      'dotnet': 'dotnet format --verify-no-changes',
      'rust': 'cargo fmt -- --check',
      'ruby': 'rubocop --auto-correct',
      'php': 'phpcbf'
    };
    return commands[language] || 'echo "Check formatting"';
  }
  
  private getTypeCheckCommand(language: string): string {
    const commands: Record<string, string> = {
      'typescript': 'tsc --noEmit',
      'python': 'mypy src/',
      'kotlin': 'kotlinc -Werror'
    };
    return commands[language] || 'echo "Type checking not applicable"';
  }
  
  private getComplexityCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npx code-complexity . --max 10',
      'typescript': 'npx code-complexity . --max 10',
      'python': 'radon cc src/ -s',
      'java': 'mvn javancss:report',
      'golang': 'gocyclo -over 10 .',
      'dotnet': 'dotnet tool run dotnet-complexity',
      'rust': 'cargo complexity',
      'ruby': 'rubocop --only Metrics',
      'php': 'phpmd src text codesize'
    };
    return commands[language] || 'echo "Complexity analysis"';
  }
  
  private getTestCommand(language: string, testType: string): string {
    const commands: Record<string, string> = {
      'nodejs': `npm run test:${testType}`,
      'typescript': `npm run test:${testType}`,
      'react': `npm run test:${testType}`,
      'python': `pytest tests/${testType}`,
      'java': `mvn test -Dtest.type=${testType}`,
      'golang': `go test ./... -tags=${testType}`,
      'dotnet': `dotnet test --filter Category=${testType}`,
      'rust': `cargo test --test ${testType}`,
      'ruby': `bundle exec rspec spec/${testType}`,
      'php': `phpunit tests/${testType}`
    };
    return commands[language] || `echo "Run ${testType} tests"`;
  }
  
  private getBuildArtifacts(language: string): string {
    const artifacts: Record<string, string> = {
      'nodejs': 'dist/',
      'typescript': 'dist/',
      'react': 'build/',
      'python': 'dist/',
      'java': 'target/',
      'golang': 'app',
      'dotnet': 'bin/',
      'rust': 'target/release/',
      'ruby': 'pkg/',
      'php': 'build/'
    };
    return artifacts[language] || 'build/';
  }
  
  private getDBSetupCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npm run db:migrate',
      'typescript': 'npm run db:migrate',
      'python': 'python manage.py migrate',
      'java': 'mvn flyway:migrate',
      'golang': 'go run cmd/migrate/main.go',
      'dotnet': 'dotnet ef database update',
      'rust': 'diesel migration run',
      'ruby': 'bundle exec rake db:migrate',
      'php': 'php artisan migrate'
    };
    return commands[language] || 'echo "Setup database"';
  }
  
  private getMatrixConfig(config: CICDTemplateConfig): string {
    if (!config.matrixBuilds) return '';
    
    const matrices: string[] = [];
    
    // Language version matrix
    switch (config.language) {
      case 'nodejs':
      case 'typescript':
      case 'react':
        matrices.push('node: [18, 20, 21]');
        break;
      case 'python':
        matrices.push('python: [3.9, 3.10, 3.11, 3.12]');
        break;
      case 'java':
        matrices.push('java: [11, 17, 21]');
        break;
      case 'golang':
        matrices.push('go: [1.19, 1.20, 1.21]');
        break;
      case 'dotnet':
        matrices.push('dotnet: [6.0, 7.0, 8.0]');
        break;
    }
    
    return matrices.join('\\n        ');
  }
  
  private generateE2ETestJob(config: CICDTemplateConfig): string {
    return `
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [build, integration-tests]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts-ubuntu-latest
      
      - name: Start application
        run: |
          npm run start:test &
          npx wait-on http://localhost:3000
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/`;
  }
  
  private generateSnykScan(config: CICDTemplateConfig): string {
    return `
      - name: Run Snyk security scan
        uses: snyk/actions/${config.language}@master
        with:
          args: --severity-threshold=high
        env:
          SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}`;
  }
  
  private generateSonarQubeScan(config: CICDTemplateConfig): string {
    return `
      - name: SonarQube scan
        uses: sonarsource/sonarqube-scan-action@master
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: \${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: \${{ secrets.SONAR_HOST_URL }}`;
  }
  
  private getLicenseCheckCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npx license-checker --onlyAllow "MIT;Apache-2.0;BSD-3-Clause;ISC"',
      'python': 'pip-licenses --fail-on="GPL"',
      'java': 'mvn license:check',
      'golang': 'go-licenses check ./...',
      'dotnet': 'dotnet-project-licenses -i . --allowed-license-types MIT Apache',
      'rust': 'cargo-license -d',
      'ruby': 'license_finder',
      'php': 'composer licenses'
    };
    return commands[language] || 'echo "License check"';
  }
  
  private generatePerformanceJob(config: CICDTemplateConfig): string {
    return `
  performance:
    name: Performance Testing
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts-ubuntu-latest
      
      - name: Start application
        run: |
          ${this.getStartCommand(config.language)} &
          sleep 10
      
      - name: Run load tests
        run: |
          k6 run tests/performance/load-test.js
      
      - name: Run stress tests
        run: |
          k6 run tests/performance/stress-test.js
      
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results/`;
  }
  
  private getStartCommand(language: string): string {
    const commands: Record<string, string> = {
      'nodejs': 'npm start',
      'typescript': 'npm start',
      'react': 'npm start',
      'python': 'python app.py',
      'java': 'java -jar target/app.jar',
      'golang': './app',
      'dotnet': 'dotnet run',
      'rust': './target/release/app',
      'ruby': 'bundle exec rails server',
      'php': 'php -S localhost:8000'
    };
    return commands[language] || 'echo "Start application"';
  }
  
  private generateDeployJobs(config: CICDTemplateConfig): string {
    if (!config.environments) return '';
    
    const jobs: string[] = [];
    
    for (const env of config.environments) {
      jobs.push(`
  deploy-${env.name}:
    name: Deploy to ${env.name}
    runs-on: ubuntu-latest
    needs: [build, unit-tests, integration-tests, security]
    if: \${{ needs.initialize.outputs.should-deploy == 'true' && needs.initialize.outputs.environment == '${env.name}' }}
    environment:
      name: ${env.name}
      url: ${env.url || `https://${env.name}.example.com`}
    steps:
      - uses: actions/checkout@v4
      
      - name: Download Docker image
        if: \${{ ${config.dockerEnabled ? 'true' : 'false'} }}
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts-ubuntu-latest
      
      - name: Load Docker image
        if: \${{ ${config.dockerEnabled ? 'true' : 'false'} }}
        run: |
          gunzip -c image.tar.gz | docker load
      
      - name: Push to registry
        if: \${{ ${config.dockerEnabled ? 'true' : 'false'} }}
        run: |
          echo "\${{ secrets.REGISTRY_PASSWORD }}" | docker login \${{ env.REGISTRY }} -u \${{ secrets.REGISTRY_USERNAME }} --password-stdin
          docker tag \${{ env.IMAGE_NAME }}:\${{ needs.initialize.outputs.version }} \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ needs.initialize.outputs.version }}
          docker push \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ needs.initialize.outputs.version }}
      
      ${env.approvalRequired ? `- name: Wait for approval
        uses: trstringer/manual-approval@v1
        with:
          secret: \${{ github.TOKEN }}
          approvers: platform-team,devops-team
          minimum-approvals: 1` : ''}
      
      - name: Deploy using ${config.deploymentStrategy || 'rolling'} strategy
        run: |
          ./scripts/deploy-${config.deploymentStrategy || 'rolling'}.sh \\
            --environment ${env.name} \\
            --version \${{ needs.initialize.outputs.version }} \\
            --image \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ needs.initialize.outputs.version }}
      
      ${env.healthChecks && env.healthChecks.length > 0 ? `- name: Health checks
        run: |
          ./scripts/health-check.sh --environment ${env.name}` : ''}
      
      - name: Smoke tests
        run: |
          ./scripts/smoke-test.sh --url ${env.url || `https://${env.name}.example.com`}
      
      ${config.rollbackEnabled ? `- name: Setup rollback
        if: failure()
        run: |
          ./scripts/rollback.sh --environment ${env.name}` : ''}`);
    }
    
    return jobs.join('\\n');
  }
  
  private generateSlackNotification(): string {
    return `
      - name: Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: \${{ steps.status.outputs.status }}
          text: |
            Pipeline: \${{ github.workflow }}
            Result: \${{ steps.status.outputs.status }}
            Branch: \${{ github.ref }}
            Commit: \${{ github.sha }}
            Author: \${{ github.actor }}
          webhook_url: \${{ secrets.SLACK_WEBHOOK }}
        if: always()`;
  }
  
  private generateTeamsNotification(): string {
    return `
      - name: Teams notification
        uses: skitionek/notify-microsoft-teams@master
        with:
          webhook_url: \${{ secrets.TEAMS_WEBHOOK }}
          job: \${{ toJson(job) }}
          steps: \${{ toJson(steps) }}
        if: always()`;
  }
  
  private generateJiraUpdate(): string {
    return `
      - name: Update Jira
        uses: atlassian/gajira-transition@master
        with:
          issue: \${{ github.event.pull_request.title }}
          transition: "Done"
        env:
          JIRA_BASE_URL: \${{ secrets.JIRA_BASE_URL }}
          JIRA_USER_EMAIL: \${{ secrets.JIRA_USER_EMAIL }}
          JIRA_API_TOKEN: \${{ secrets.JIRA_API_TOKEN }}`;
  }
  
  private getCodeQLLanguage(language: string): string {
    const languages: Record<string, string> = {
      'nodejs': 'javascript',
      'typescript': 'javascript',
      'react': 'javascript',
      'python': 'python',
      'java': 'java',
      'golang': 'go',
      'dotnet': 'csharp',
      'rust': 'cpp',
      'ruby': 'ruby',
      'php': 'php',
      'kotlin': 'java',
      'swift': 'swift',
      'cpp': 'cpp'
    };
    return languages[language] || 'javascript';
  }
  
  private getPackageEcosystem(language: string): string {
    const ecosystems: Record<string, string> = {
      'nodejs': 'npm',
      'typescript': 'npm',
      'react': 'npm',
      'python': 'pip',
      'java': 'maven',
      'golang': 'gomod',
      'dotnet': 'nuget',
      'rust': 'cargo',
      'ruby': 'bundler',
      'php': 'composer'
    };
    return ecosystems[language] || 'npm';
  }
  
  private generatePRTemplate(): string {
    return `## Description
Brief description of the changes in this PR.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Add any additional notes or context about the PR here.`;
  }
  
  private generateBugTemplate(): string {
    return `---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. macOS, Windows, Linux]
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Additional context**
Add any other context about the problem here.`;
  }
  
  private generateFeatureTemplate(): string {
    return `---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.`;
  }
  
  private generateDocumentation(config: CICDTemplateConfig): string {
    return `# CI/CD Pipeline Documentation

## Overview
This repository uses GitHub Actions for continuous integration and deployment.

## Pipeline Structure

### Stages
1. **Initialize**: Sets up pipeline variables and determines deployment conditions
2. **Quality**: Runs code quality checks (linting, formatting, type checking)
3. **Build**: Builds the application and creates Docker images
4. **Test**: Runs unit, integration, and E2E tests
5. **Security**: Performs security scanning and vulnerability checks
6. **Deploy**: Deploys to various environments using ${config.deploymentStrategy || 'rolling'} strategy

## Configuration

### Required Secrets
${this.getMetadata().requiredSecrets?.map(s => `- \`${s}\``).join('\\n')}

### Environment Variables
- \`NODE_VERSION\`: Node.js version to use
- \`REGISTRY\`: Container registry URL
- \`IMAGE_NAME\`: Docker image name

## Workflows

### Main Workflow (\`.github/workflows/ci-cd.yml\`)
Triggered on:
- Push to main, develop, or release branches
- Pull requests to main or develop
- Manual workflow dispatch
- Scheduled security scans (weekly)

### Reusable Workflows
- \`tests.yml\`: Reusable test workflow
- \`security.yml\`: Security scanning workflow
- \`deploy.yml\`: Deployment workflow

## Testing

### Test Types
- **Unit Tests**: Test individual components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Test application performance

### Coverage Requirements
Minimum coverage threshold: ${config.coverageThreshold || 80}%

## Deployment

### Environments
${config.environments?.map(env => `- **${env.name}**: ${env.url || 'TBD'}`).join('\\n')}

### Deployment Strategy
Using ${config.deploymentStrategy || 'rolling'} deployment strategy.

### Rollback
${config.rollbackEnabled ? 'Automatic rollback enabled on deployment failure.' : 'Manual rollback required.'}

## Quality Gates
${config.qualityGates ? Object.entries(config.qualityGates)
  .map(([key, value]) => `- **${key}**: ${value}`)
  .join('\\n') : 'No quality gates configured.'}

## Monitoring
${config.integrations ? Object.entries(config.integrations)
  .filter(([_, enabled]) => enabled)
  .map(([service]) => `- ${service}`)
  .join('\\n') : 'No monitoring integrations configured.'}

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check dependency versions
   - Review build logs for errors
   - Ensure all required environment variables are set

2. **Test Failures**
   - Review test output
   - Check for flaky tests
   - Ensure test environment is properly configured

3. **Deployment Failures**
   - Verify cloud credentials
   - Check deployment logs
   - Ensure target environment is accessible

## Contributing
Please ensure all tests pass and coverage requirements are met before submitting a PR.

## Support
Contact the Platform Team for assistance.`;
  }
}