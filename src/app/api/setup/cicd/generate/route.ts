/**
 * CI/CD Configuration Generation API
 * Generates platform-specific CI/CD configuration files
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateRequestBody } from '@/lib/security/input-validation';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkTenantAdminRights } from '@/lib/permissions/SystemPermissions';
import { createAuditLog } from '@/lib/audit/AuditService';

interface CICDConfiguration {
  provider: string;
  repositoryUrl: string;
  defaultBranch: string;
  buildTriggers: string[];
  stages: PipelineStage[];
  environments: EnvironmentConfig[];
  notifications: {
    email: string[];
    slack?: string;
    webhooks: string[];
  };
  security: {
    enableSonarQube: boolean;
    enableSecurityScanning: boolean;
    enableDependencyCheck: boolean;
    requireCodeReview: boolean;
  };
  deployment: {
    strategy: 'ROLLING' | 'BLUE_GREEN' | 'CANARY';
    containerRegistry?: string;
    kubernetesCluster?: string;
    healthChecks: boolean;
    rollbackOnFailure: boolean;
  };
}

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
  order: number;
}

interface EnvironmentConfig {
  name: string;
  type: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  url?: string;
  autoDeployment: boolean;
  requiresApproval: boolean;
  notifications: string[];
  secrets: string[];
}

/**
 * POST - Generate CI/CD configuration files
 */
export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for CI/CD configuration generation'
      }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate the configuration
    const validation = validateRequestBody(body, {
      provider: { type: 'text', required: true, enum: ['github-actions', 'gitlab-ci', 'jenkins', 'azure-devops'] },
      repositoryUrl: { type: 'url', required: true },
      defaultBranch: { type: 'text', required: true },
      buildTriggers: { type: 'array', required: false },
      stages: { type: 'array', required: true },
      environments: { type: 'array', required: true },
      notifications: { type: 'json', required: false },
      security: { type: 'json', required: false },
      deployment: { type: 'json', required: false }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid configuration data',
        details: validation.errors
      }, { status: 400 });
    }

    const configuration = validation.sanitized as CICDConfiguration;

    // Generate the configuration based on provider
    const result = await generateCICDConfiguration(configuration);

    // Create audit log
    await createAuditLog({
      tenantId: tenantContext.tenant.id,
      action: 'cicd:configuration:generate',
      resource: 'cicd_configuration',
      resourceId: `${configuration.provider}-${Date.now()}`,
      metadata: {
        provider: configuration.provider,
        repositoryUrl: configuration.repositoryUrl,
        stagesCount: configuration.stages.filter(s => s.enabled).length,
        environmentsCount: configuration.environments.length
      }
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('CI/CD configuration generation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate CI/CD configuration'
    }, { status: 500 });
  }
}

/**
 * Generate CI/CD configuration based on provider
 */
async function generateCICDConfiguration(config: CICDConfiguration) {
  const { provider } = config;
  
  switch (provider) {
    case 'github-actions':
      return generateGitHubActionsConfig(config);
    
    case 'gitlab-ci':
      return generateGitLabCIConfig(config);
    
    case 'jenkins':
      return generateJenkinsConfig(config);
    
    case 'azure-devops':
      return generateAzureDevOpsConfig(config);
    
    default:
      throw new Error(`Unsupported CI/CD provider: ${provider}`);
  }
}

/**
 * Generate comprehensive GitHub Actions workflow
 */
function generateGitHubActionsConfig(config: CICDConfiguration) {
  const enabledStages = config.stages.filter(stage => stage.enabled).sort((a, b) => a.order - b.order);
  
  const workflowConfig = `name: ${getRepositoryName(config.repositoryUrl)} CI/CD

on:
${generateGitHubTriggers(config.buildTriggers, config.defaultBranch)}

env:
  NODE_VERSION: '${getNodeVersion(config)}'
  REGISTRY: ghcr.io
  IMAGE_NAME: $\{{ github.repository }}

jobs:
${generateGitHubJobs(enabledStages, config)}

${generateGitHubDeploymentJobs(config)}`;

  return {
    config: workflowConfig,
    filename: '.github/workflows/ci-cd.yml',
    provider: 'github-actions',
    additionalFiles: generateGitHubAdditionalFiles(config),
    instructions: [
      '1. Create .github/workflows/ directory in your repository',
      '2. Save the configuration as .github/workflows/ci-cd.yml',
      '3. Configure repository secrets for deployment',
      '4. Commit and push to trigger the workflow',
      '5. Monitor the Actions tab for pipeline execution'
    ],
    secrets: generateRequiredSecrets(config),
    nextSteps: [
      'Configure environment protection rules',
      'Set up deployment approvals for production',
      'Add status checks to branch protection',
      'Configure notification settings'
    ]
  };
}

function generateGitHubTriggers(triggers: string[], defaultBranch: string): string {
  const triggerConfig = [];
  
  if (triggers.includes('push')) {
    triggerConfig.push(`  push:
    branches: [ ${defaultBranch} ]
    paths-ignore:
      - 'docs/**'
      - '*.md'`);
  }
  
  if (triggers.includes('pull_request')) {
    triggerConfig.push(`  pull_request:
    branches: [ ${defaultBranch} ]
    types: [opened, synchronize, reopened]`);
  }
  
  if (triggers.includes('schedule')) {
    triggerConfig.push(`  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM`);
  }
  
  if (triggers.includes('manual')) {
    triggerConfig.push(`  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: false
        default: 'staging'
        type: choice
        options:
          - staging
          - production`);
  }
  
  return triggerConfig.join('\n');
}

function generateGitHubJobs(stages: PipelineStage[], config: CICDConfiguration): string {
  const jobs = [];
  
  // Quality checks job
  const qualityStages = stages.filter(s => ['checkout', 'install', 'lint', 'test'].includes(s.id));
  if (qualityStages.length > 0) {
    jobs.push(`  quality:
    name: Code Quality & Testing
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: ${getCheckoutDepth(stages)}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      ${generateGitHubQualitySteps(qualityStages, config)}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            coverage/
            test-results.xml
          retention-days: 7`);
  }
  
  // Security scanning job
  if (stages.some(s => s.id === 'security') || config.security.enableSecurityScanning) {
    jobs.push(`  security:
    name: Security Scanning
    runs-on: ubuntu-latest
    needs: quality
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Run dependency check
        if: \${{ ${config.security.enableDependencyCheck} }}
        uses: actions/dependency-review-action@v4
      
      - name: Security vulnerability scan
        if: \${{ ${config.security.enableSecurityScanning} }}
        uses: github/codeql-action/init@v3
        with:
          languages: javascript
      
      - name: Perform CodeQL Analysis
        if: \${{ ${config.security.enableSecurityScanning} }}
        uses: github/codeql-action/analyze@v3`);
  }
  
  // Build job
  if (stages.some(s => ['build', 'docker'].includes(s.id))) {
    jobs.push(`  build:
    name: Build & Package
    runs-on: ubuntu-latest
    needs: [quality${config.security.enableSecurityScanning ? ', security' : ''}]
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production
      
      ${generateDockerSteps(stages, config)}
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            dist/
            build/
          retention-days: 7`);
  }
  
  return jobs.join('\n\n');
}

function generateGitHubQualitySteps(stages: PipelineStage[], config: CICDConfiguration): string {
  const steps = [];
  
  const lintStage = stages.find(s => s.id === 'lint');
  if (lintStage) {
    steps.push(`      - name: Run linting
        run: npm run lint
        ${lintStage.config.failOnError === false ? 'continue-on-error: true' : ''}`);
  }
  
  const testStage = stages.find(s => s.id === 'test');
  if (testStage) {
    steps.push(`      - name: Run tests
        run: npm test
        env:
          CI: true
      
      - name: Generate coverage report
        if: \${{ ${testStage.config.coverage || false} }}
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        if: \${{ ${testStage.config.coverage || false} }}
        uses: codecov/codecov-action@v4
        with:
          token: \${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: true`);
  }
  
  return steps.join('\n\n');
}

function generateDockerSteps(stages: PipelineStage[], config: CICDConfiguration): string {
  const dockerStage = stages.find(s => s.id === 'docker');
  if (!dockerStage || !dockerStage.enabled) {
    return '';
  }
  
  return `      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max`;
}

function generateGitHubDeploymentJobs(config: CICDConfiguration): string {
  if (!config.environments.length) {
    return '';
  }
  
  return config.environments.map(env => `
  deploy-${env.name.toLowerCase()}:
    name: Deploy to ${env.name}
    runs-on: ubuntu-latest
    needs: [build]
    ${env.type === 'PRODUCTION' ? 'if: github.ref == \'refs/heads/' + config.defaultBranch + '\'' : ''}
    environment:
      name: ${env.name.toLowerCase()}
      ${env.url ? `url: ${env.url}` : ''}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts
          path: ./artifacts
      
      ${env.requiresApproval ? `- name: Wait for approval
        if: \${{ ${env.type === 'PRODUCTION'} }}
        uses: trstringer/manual-approval@v1
        with:
          secret: \${{ secrets.GITHUB_TOKEN }}
          approvers: \${{ vars.DEPLOYMENT_APPROVERS }}
          minimum-approvals: 1
          issue-title: "Deploy to ${env.name}"` : ''}
      
      - name: Deploy to ${env.name}
        run: |
          echo "Deploying to ${env.name} environment"
          # Add your deployment logic here
          # Examples:
          # - kubectl apply -f k8s/
          # - aws s3 sync ./artifacts s3://your-bucket
          # - scp ./artifacts user@server:/var/www/html
        env:
          ENVIRONMENT: ${env.name.toLowerCase()}
          ${env.url ? `DEPLOYMENT_URL: ${env.url}` : ''}
      
      ${config.deployment.healthChecks ? `- name: Health check
        run: |
          echo "Performing health check..."
          # Add health check logic
          # curl -f \${{ env.DEPLOYMENT_URL }}/health || exit 1` : ''}
      
      ${generateNotificationSteps(config, env)}
`).join('');
}

function generateNotificationSteps(config: CICDConfiguration, env: EnvironmentConfig): string {
  const steps = [];
  
  if (config.notifications.email.length > 0) {
    steps.push(`      - name: Send email notification
        if: always()
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.gmail.com
          server_port: 587
          username: \${{ secrets.EMAIL_USERNAME }}
          password: \${{ secrets.EMAIL_PASSWORD }}
          subject: "Deployment to ${env.name}: \${{ job.status }}"
          body: |
            Deployment to ${env.name} has \${{ job.status }}.
            
            Repository: \${{ github.repository }}
            Commit: \${{ github.sha }}
            Author: \${{ github.actor }}
            
            View details: \${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}
          to: ${config.notifications.email.join(', ')}`);
  }
  
  if (config.notifications.slack) {
    steps.push(`      - name: Send Slack notification
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: \${{ job.status }}
          channel: '#deployments'
          webhook_url: \${{ secrets.SLACK_WEBHOOK }}
          fields: repo,message,commit,author,action,eventName,ref,workflow`);
  }
  
  return steps.join('\n\n');
}

/**
 * Generate GitLab CI configuration
 */
function generateGitLabCIConfig(config: CICDConfiguration) {
  const enabledStages = config.stages.filter(stage => stage.enabled).sort((a, b) => a.order - b.order);
  
  const ciConfig = `# GitLab CI/CD Pipeline for ${getRepositoryName(config.repositoryUrl)}

stages:
${enabledStages.map(stage => `  - ${stage.id}`).join('\n')}
${config.environments.length > 0 ? '  - deploy' : ''}

variables:
  NODE_VERSION: "${getNodeVersion(config)}"
  npm_config_cache: "$CI_PROJECT_DIR/.npm"
  CYPRESS_CACHE_FOLDER: "$CI_PROJECT_DIR/cache/Cypress"

# Cache configuration
cache:
  paths:
    - .npm/
    - cache/Cypress/
    - node_modules/

# Global before script
before_script:
  - node --version
  - npm --version

${generateGitLabStages(enabledStages, config)}

${generateGitLabDeploymentStages(config)}

# Include additional configurations
include:
  - template: Security/Secret-Detection.gitlab-ci.yml
  ${config.security.enableSecurityScanning ? '- template: Security/SAST.gitlab-ci.yml' : ''}
  ${config.security.enableDependencyCheck ? '- template: Security/Dependency-Scanning.gitlab-ci.yml' : ''}`;

  return {
    config: ciConfig,
    filename: '.gitlab-ci.yml',
    provider: 'gitlab-ci',
    additionalFiles: generateGitLabAdditionalFiles(config),
    instructions: [
      '1. Save configuration as .gitlab-ci.yml in repository root',
      '2. Configure CI/CD variables in project settings',
      '3. Set up GitLab Runner if using self-hosted',
      '4. Commit and push to trigger first pipeline',
      '5. Monitor Pipelines page for execution status'
    ],
    variables: generateRequiredVariables(config),
    nextSteps: [
      'Configure environment-specific variables',
      'Set up deployment keys for target servers',
      'Configure merge request pipelines',
      'Set up pipeline schedules for regular runs'
    ]
  };
}

function generateGitLabStages(stages: PipelineStage[], config: CICDConfiguration): string {
  return stages.map(stage => {
    switch (stage.id) {
      case 'install':
        return `# Install dependencies
install:
  stage: install
  image: node:\${NODE_VERSION}
  script:
    - npm ci
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour`;

      case 'lint':
        return `# Code linting
lint:
  stage: lint
  image: node:\${NODE_VERSION}
  dependencies:
    - install
  script:
    - npm run lint
  ${stage.config.failOnError === false ? 'allow_failure: true' : ''}
  artifacts:
    reports:
      junit: lint-results.xml`;

      case 'test':
        return `# Run tests
test:
  stage: test
  image: node:\${NODE_VERSION}
  dependencies:
    - install
  script:
    - npm test
  ${stage.config.coverage ? `coverage: '/Coverage: \\d+\\.\\d+/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
      junit: test-results.xml
    paths:
      - coverage/
    expire_in: 1 week` : ''}`;

      case 'build':
        return `# Build application
build:
  stage: build
  image: node:\${NODE_VERSION}
  dependencies:
    - install
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
      - build/
    expire_in: 1 week`;

      case 'security':
        return `# Security scanning
security_scan:
  stage: security
  image: securecodewarrior/github-action-add-sarif
  script:
    - echo "Security scanning completed by GitLab templates"
  dependencies: []`;

      case 'docker':
        return `# Build Docker image
docker_build:
  stage: docker
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - ${config.defaultBranch}`;

      default:
        return `# ${stage.name}
${stage.id}:
  stage: ${stage.id}
  image: node:\${NODE_VERSION}
  script:
    - echo "Executing ${stage.name}"`;
    }
  }).join('\n\n');
}

function generateGitLabDeploymentStages(config: CICDConfiguration): string {
  if (!config.environments.length) {
    return '';
  }
  
  return config.environments.map(env => `
# Deploy to ${env.name}
deploy_${env.name.toLowerCase()}:
  stage: deploy
  image: ubuntu:latest
  script:
    - echo "Deploying to ${env.name}"
    # Add deployment logic here
  environment:
    name: ${env.name.toLowerCase()}
    ${env.url ? `url: ${env.url}` : ''}
  ${env.type === 'PRODUCTION' ? `only:
    - ${config.defaultBranch}` : ''}
  ${env.requiresApproval ? 'when: manual' : ''}
  ${env.autoDeployment ? '' : 'when: manual'}
`).join('');
}

/**
 * Generate Jenkins pipeline configuration
 */
function generateJenkinsConfig(config: CICDConfiguration) {
  const enabledStages = config.stages.filter(stage => stage.enabled).sort((a, b) => a.order - b.order);
  
  const pipelineConfig = `// Jenkins Pipeline for ${getRepositoryName(config.repositoryUrl)}
pipeline {
    agent any
    
    tools {
        nodejs '${getNodeVersion(config)}'
    }
    
    environment {
        NODE_ENV = 'production'
        npm_config_cache = 'npm-cache'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 1, unit: 'HOURS')
        skipStagesAfterUnstable()
    }
    
    triggers {
        ${generateJenkinsTriggers(config.buildTriggers)}
    }
    
    stages {
${generateJenkinsStages(enabledStages, config)}
${generateJenkinsDeploymentStages(config)}
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            ${generateJenkinsNotifications(config, 'success')}
        }
        failure {
            ${generateJenkinsNotifications(config, 'failure')}
        }
        unstable {
            ${generateJenkinsNotifications(config, 'unstable')}
        }
    }
}`;

  return {
    config: pipelineConfig,
    filename: 'Jenkinsfile',
    provider: 'jenkins',
    additionalFiles: generateJenkinsAdditionalFiles(config),
    instructions: [
      '1. Save configuration as Jenkinsfile in repository root',
      '2. Create new Pipeline job in Jenkins',
      '3. Configure job to use "Pipeline script from SCM"',
      '4. Install required Jenkins plugins',
      '5. Configure global tool configurations for Node.js'
    ],
    plugins: [
      'NodeJS Plugin',
      'Pipeline Plugin',
      'Git Plugin',
      'Email Extension Plugin',
      'Slack Notification Plugin'
    ],
    nextSteps: [
      'Set up Jenkins agents for parallel execution',
      'Configure Jenkins credentials for deployments',
      'Set up webhook triggers from SCM',
      'Configure pipeline libraries for reusable code'
    ]
  };
}

function generateJenkinsTriggers(triggers: string[]): string {
  const triggerConfig = [];
  
  if (triggers.includes('schedule')) {
    triggerConfig.push("cron('H 2 * * 1')");
  }
  
  if (triggers.includes('push')) {
    triggerConfig.push('githubPush()');
  }
  
  return triggerConfig.join('\n        ');
}

function generateJenkinsStages(stages: PipelineStage[], config: CICDConfiguration): string {
  return stages.map(stage => {
    switch (stage.id) {
      case 'checkout':
        return `        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }`;

      case 'install':
        return `        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
            post {
                success {
                    stash includes: 'node_modules/**', name: 'node_modules'
                }
            }
        }`;

      case 'lint':
        return `        stage('Code Linting') {
            steps {
                unstash 'node_modules'
                sh 'npm run lint'
            }
            ${stage.config.failOnError === false ? 'post {\n                failure {\n                    echo "Linting failed but continuing"\n                }\n            }' : ''}
        }`;

      case 'test':
        return `        stage('Run Tests') {
            steps {
                unstash 'node_modules'
                sh 'npm test'
            }
            post {
                always {
                    ${stage.config.coverage ? `publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])` : ''}
                    publishTestResults testResultsPattern: 'test-results.xml'
                }
            }
        }`;

      case 'build':
        return `        stage('Build Application') {
            steps {
                unstash 'node_modules'
                sh 'npm run build'
            }
            post {
                success {
                    archiveArtifacts artifacts: 'dist/**', fingerprint: true
                }
            }
        }`;

      case 'docker':
        return `        stage('Build Docker Image') {
            when {
                branch '${config.defaultBranch}'
            }
            steps {
                script {
                    def image = docker.build("${getRepositoryName(config.repositoryUrl)}:\${env.GIT_COMMIT_SHORT}")
                    docker.withRegistry('https://registry.hub.docker.com', 'docker-hub-credentials') {
                        image.push()
                        image.push('latest')
                    }
                }
            }
        }`;

      default:
        return `        stage('${stage.name}') {
            steps {
                echo 'Executing ${stage.name}'
            }
        }`;
    }
  }).join('\n\n');
}

function generateJenkinsDeploymentStages(config: CICDConfiguration): string {
  if (!config.environments.length) {
    return '';
  }
  
  return config.environments.map(env => `
        stage('Deploy to ${env.name}') {
            ${env.type === 'PRODUCTION' ? `when {
                branch '${config.defaultBranch}'
            }` : ''}
            ${env.requiresApproval ? `input {
                message "Deploy to ${env.name}?"
                ok "Deploy"
                parameters {
                    choice(name: 'DEPLOY_STRATEGY', choices: ['${config.deployment.strategy}', 'MANUAL'], description: 'Deployment strategy')
                }
            }` : ''}
            steps {
                echo "Deploying to ${env.name} environment"
                // Add deployment logic here
                ${config.deployment.healthChecks ? `
                script {
                    // Health check
                    def response = sh(
                        script: "curl -f ${env.url || 'http://localhost'}/health || echo 'Health check failed'",
                        returnStdout: true
                    ).trim()
                    echo "Health check response: \${response}"
                }` : ''}
            }
        }`).join('');
}

function generateJenkinsNotifications(config: CICDConfiguration, status: string): string {
  const notifications = [];
  
  if (config.notifications.email.length > 0) {
    notifications.push(`emailext (
                subject: "Pipeline ${status.toUpperCase()}: \${env.JOB_NAME} - \${env.BUILD_NUMBER}",
                body: """
                    Build ${status} for \${env.JOB_NAME}
                    
                    Build Number: \${env.BUILD_NUMBER}
                    Build URL: \${env.BUILD_URL}
                    Git Commit: \${env.GIT_COMMIT_SHORT}
                    
                    Check console output at \${env.BUILD_URL}console
                """,
                to: "${config.notifications.email.join(', ')}"
            )`);
  }
  
  return notifications.join('\n            ');
}

/**
 * Generate Azure DevOps pipeline configuration
 */
function generateAzureDevOpsConfig(config: CICDConfiguration) {
  const enabledStages = config.stages.filter(stage => stage.enabled).sort((a, b) => a.order - b.order);
  
  const pipelineConfig = `# Azure DevOps Pipeline for ${getRepositoryName(config.repositoryUrl)}

trigger:
  branches:
    include:
    - ${config.defaultBranch}
  paths:
    exclude:
    - docs/*
    - '*.md'

pr:
  branches:
    include:
    - ${config.defaultBranch}
  paths:
    exclude:
    - docs/*
    - '*.md'

variables:
  nodeVersion: '${getNodeVersion(config)}'
  vmImage: 'ubuntu-latest'

pool:
  vmImage: \$(vmImage)

stages:
${generateAzureStages(enabledStages, config)}

${generateAzureDeploymentStages(config)}`;

  return {
    config: pipelineConfig,
    filename: 'azure-pipelines.yml',
    provider: 'azure-devops',
    additionalFiles: generateAzureAdditionalFiles(config),
    instructions: [
      '1. Save configuration as azure-pipelines.yml',
      '2. Create new Pipeline in Azure DevOps',
      '3. Connect to your repository',
      '4. Select existing Azure Pipelines YAML file',
      '5. Configure service connections for deployments'
    ],
    serviceConnections: [
      'Container Registry',
      'Kubernetes Service',
      'Azure Resource Manager'
    ],
    nextSteps: [
      'Set up variable groups for environments',
      'Configure environment approvals',
      'Set up service connections',
      'Configure pipeline permissions'
    ]
  };
}

function generateAzureStages(stages: PipelineStage[], config: CICDConfiguration): string {
  const qualityStages = stages.filter(s => ['install', 'lint', 'test'].includes(s.id));
  const buildStages = stages.filter(s => ['build', 'docker'].includes(s.id));
  
  const stageConfigs = [];
  
  if (qualityStages.length > 0) {
    stageConfigs.push(`- stage: Quality
  displayName: 'Code Quality & Testing'
  jobs:
  - job: QualityChecks
    displayName: 'Quality Checks'
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '\$(nodeVersion)'
      displayName: 'Install Node.js'
    
    - script: npm ci
      displayName: 'Install dependencies'
    
    ${generateAzureQualitySteps(qualityStages, config)}`);
  }
  
  if (buildStages.length > 0) {
    stageConfigs.push(`- stage: Build
  displayName: 'Build & Package'
  dependsOn: Quality
  condition: succeeded()
  jobs:
  - job: BuildApp
    displayName: 'Build Application'
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '\$(nodeVersion)'
      displayName: 'Install Node.js'
    
    - script: npm ci
      displayName: 'Install dependencies'
    
    - script: npm run build
      displayName: 'Build application'
      env:
        NODE_ENV: production
    
    ${generateAzureBuildSteps(buildStages, config)}`);
  }
  
  return stageConfigs.join('\n\n');
}

function generateAzureQualitySteps(stages: PipelineStage[], config: CICDConfiguration): string {
  const steps = [];
  
  const lintStage = stages.find(s => s.id === 'lint');
  if (lintStage) {
    steps.push(`    - script: npm run lint
      displayName: 'Run linting'
      ${lintStage.config.failOnError === false ? 'continueOnError: true' : ''}`);
  }
  
  const testStage = stages.find(s => s.id === 'test');
  if (testStage) {
    steps.push(`    - script: npm test
      displayName: 'Run tests'
      env:
        CI: true
    
    ${testStage.config.coverage ? `- task: PublishCodeCoverageResults@1
      inputs:
        codeCoverageTool: 'Cobertura'
        summaryFileLocation: 'coverage/cobertura-coverage.xml'
      displayName: 'Publish coverage results'` : ''}
    
    - task: PublishTestResults@2
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: 'test-results.xml'
        failTaskOnFailedTests: true
      displayName: 'Publish test results'`);
  }
  
  return steps.join('\n\n');
}

function generateAzureBuildSteps(stages: PipelineStage[], config: CICDConfiguration): string {
  const steps = [];
  
  steps.push(`    - task: PublishBuildArtifacts@1
      inputs:
        pathToPublish: 'dist'
        artifactName: 'build-artifacts'
      displayName: 'Publish build artifacts'`);
  
  const dockerStage = stages.find(s => s.id === 'docker');
  if (dockerStage && dockerStage.enabled) {
    steps.push(`    - task: Docker@2
      inputs:
        containerRegistry: '\$(containerRegistry)'
        repository: '\$(imageName)'
        command: 'buildAndPush'
        Dockerfile: 'Dockerfile'
        tags: |
          \$(Build.BuildId)
          latest
      displayName: 'Build and push Docker image'`);
  }
  
  return steps.join('\n\n');
}

function generateAzureDeploymentStages(config: CICDConfiguration): string {
  if (!config.environments.length) {
    return '';
  }
  
  return config.environments.map(env => `
- stage: Deploy${env.name}
  displayName: 'Deploy to ${env.name}'
  dependsOn: Build
  ${env.type === 'PRODUCTION' ? `condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/${config.defaultBranch}'))` : 'condition: succeeded()'}
  jobs:
  - deployment: Deploy${env.name}
    displayName: 'Deploy to ${env.name}'
    environment: '${env.name.toLowerCase()}'
    ${env.requiresApproval && env.type === 'PRODUCTION' ? `condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/${config.defaultBranch}'))` : ''}
    strategy:
      runOnce:
        deploy:
          steps:
          - task: DownloadBuildArtifacts@0
            inputs:
              buildType: 'current'
              artifactName: 'build-artifacts'
              downloadPath: '\$(System.ArtifactsDirectory)'
            displayName: 'Download build artifacts'
          
          - script: |
              echo "Deploying to ${env.name} environment"
              # Add your deployment logic here
            displayName: 'Deploy application'
            env:
              ENVIRONMENT: ${env.name.toLowerCase()}
              ${env.url ? `DEPLOYMENT_URL: ${env.url}` : ''}
          
          ${config.deployment.healthChecks ? `- script: |
              echo "Performing health check..."
              # Add health check logic
            displayName: 'Health check'` : ''}
`).join('');
}

/**
 * Helper functions
 */
function getRepositoryName(url: string): string {
  const match = url.match(/\/([^\/]+)(?:\.git)?$/);
  return match ? match[1] : 'app';
}

function getNodeVersion(config: CICDConfiguration): string {
  const installStage = config.stages.find(s => s.id === 'install');
  return installStage?.config.nodeVersion || '18';
}

function getCheckoutDepth(stages: PipelineStage[]): number {
  const checkoutStage = stages.find(s => s.id === 'checkout');
  return checkoutStage?.config.fetchDepth || 1;
}

function generateGitHubAdditionalFiles(config: CICDConfiguration) {
  const files = [];
  
  // Dependabot configuration
  files.push({
    path: '.github/dependabot.yml',
    content: `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "@developers"
    assignees:
      - "@developers"`
  });
  
  // Issue templates
  files.push({
    path: '.github/ISSUE_TEMPLATE/bug_report.md',
    content: `---
name: Bug report
about: Create a report to help us improve
title: ''
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
A clear and concise description of what you expected to happen.`
  });
  
  return files;
}

function generateGitLabAdditionalFiles(config: CICDConfiguration) {
  return [
    {
      path: '.gitlab/merge_request_templates/Default.md',
      content: `## What does this MR do?

## Author's checklist

- [ ] Code follows style guidelines
- [ ] Self-review has been performed
- [ ] Tests have been added/updated
- [ ] Documentation has been updated`
    }
  ];
}

function generateJenkinsAdditionalFiles(config: CICDConfiguration) {
  return [
    {
      path: 'jenkins/shared-library.groovy',
      content: `// Shared Jenkins pipeline library
def deployToEnvironment(environment, artifacts) {
    echo "Deploying to \${environment}"
    // Add deployment logic
}

return this`
    }
  ];
}

function generateAzureAdditionalFiles(config: CICDConfiguration) {
  return [
    {
      path: 'azure-pipelines-templates/build-template.yml',
      content: `# Azure Pipeline Template for builds
parameters:
  - name: nodeVersion
    type: string
    default: '18'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '${{ parameters.nodeVersion }}'
  displayName: 'Install Node.js'

- script: npm ci
  displayName: 'Install dependencies'

- script: npm run build
  displayName: 'Build application'`
    }
  ];
}

function generateRequiredSecrets(config: CICDConfiguration) {
  const secrets = [];
  
  if (config.notifications.email.length > 0) {
    secrets.push('EMAIL_USERNAME', 'EMAIL_PASSWORD');
  }
  
  if (config.notifications.slack) {
    secrets.push('SLACK_WEBHOOK');
  }
  
  if (config.stages.some(s => s.id === 'docker')) {
    secrets.push('GITHUB_TOKEN');
  }
  
  if (config.stages.some(s => s.id === 'test' && s.config.coverage)) {
    secrets.push('CODECOV_TOKEN');
  }
  
  config.environments.forEach(env => {
    secrets.push(`${env.name.toUpperCase()}_DEPLOY_KEY`);
  });
  
  return secrets;
}

function generateRequiredVariables(config: CICDConfiguration) {
  const variables = [];
  
  variables.push('NODE_VERSION');
  
  if (config.stages.some(s => s.id === 'docker')) {
    variables.push('CI_REGISTRY', 'CI_REGISTRY_IMAGE');
  }
  
  config.environments.forEach(env => {
    if (env.url) {
      variables.push(`${env.name.toUpperCase()}_URL`);
    }
  });
  
  return variables;
}