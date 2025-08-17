/**
 * CI/CD Setup API
 * Handles CI/CD pipeline configuration generation and management
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
 * GET - Retrieve existing CI/CD configurations
 */
export async function GET(request: NextRequest) {
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
        error: 'Admin permissions required for CI/CD configuration'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const configType = searchParams.get('type') || 'all';

    // Mock data - in real implementation, fetch from database
    const configurations = {
      existing: [],
      providers: [
        {
          id: 'github-actions',
          name: 'GitHub Actions',
          supported: true,
          templates: ['node', 'docker', 'kubernetes']
        },
        {
          id: 'gitlab-ci',
          name: 'GitLab CI/CD',
          supported: true,
          templates: ['basic', 'docker', 'helm']
        },
        {
          id: 'jenkins',
          name: 'Jenkins',
          supported: true,
          templates: ['pipeline', 'multibranch', 'folder']
        },
        {
          id: 'azure-devops',
          name: 'Azure DevOps',
          supported: true,
          templates: ['yaml', 'classic', 'container']
        }
      ],
      templates: {
        'github-actions': {
          node: 'GitHub Actions Node.js template',
          docker: 'GitHub Actions Docker template',
          kubernetes: 'GitHub Actions Kubernetes template'
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: configType === 'all' ? configurations : configurations[configType as keyof typeof configurations]
    });

  } catch (error) {
    console.error('CI/CD configuration retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve CI/CD configuration'
    }, { status: 500 });
  }
}

/**
 * POST - Save or generate CI/CD configuration
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
        error: 'Admin permissions required for CI/CD configuration'
      }, { status: 403 });
    }

    const body = await request.json();
    
    const validation = validateRequestBody(body, {
      operation: { type: 'text', required: true, enum: ['save_configuration', 'generate_template'] },
      data: { type: 'json', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, data } = validation.sanitized;

    switch (operation) {
      case 'save_configuration':
        return await saveConfiguration(tenantContext.tenant.id, data);
      
      case 'generate_template':
        return await generateTemplate(data);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('CI/CD configuration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process CI/CD configuration'
    }, { status: 500 });
  }
}

/**
 * Save CI/CD configuration to database
 */
async function saveConfiguration(tenantId: string, configuration: CICDConfiguration) {
  try {
    // In real implementation, save to database
    const savedConfig = {
      id: `cicd-${Date.now()}`,
      tenantId,
      ...configuration,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create audit log
    await createAuditLog({
      tenantId,
      action: 'cicd:configuration:save',
      resource: 'cicd_configuration',
      resourceId: savedConfig.id,
      metadata: {
        provider: configuration.provider,
        repositoryUrl: configuration.repositoryUrl,
        stagesCount: configuration.stages.length,
        environmentsCount: configuration.environments.length
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: savedConfig.id,
        message: 'CI/CD configuration saved successfully'
      }
    });

  } catch (error) {
    console.error('Failed to save configuration:', error);
    throw error;
  }
}

/**
 * Generate CI/CD template/configuration files
 */
async function generateTemplate(configuration: CICDConfiguration) {
  try {
    const { provider } = configuration;
    
    let generatedConfig: string;
    let filename: string;

    switch (provider) {
      case 'github-actions':
        generatedConfig = generateGitHubActionsConfig(configuration);
        filename = '.github/workflows/ci-cd.yml';
        break;
      
      case 'gitlab-ci':
        generatedConfig = generateGitLabCIConfig(configuration);
        filename = '.gitlab-ci.yml';
        break;
      
      case 'jenkins':
        generatedConfig = generateJenkinsConfig(configuration);
        filename = 'Jenkinsfile';
        break;
      
      case 'azure-devops':
        generatedConfig = generateAzureDevOpsConfig(configuration);
        filename = 'azure-pipelines.yml';
        break;
      
      default:
        throw new Error(`Unsupported CI/CD provider: ${provider}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        config: generatedConfig,
        filename,
        provider,
        instructions: getProviderInstructions(provider)
      }
    });

  } catch (error) {
    console.error('Failed to generate template:', error);
    throw error;
  }
}

/**
 * Generate GitHub Actions workflow configuration
 */
function generateGitHubActionsConfig(config: CICDConfiguration): string {
  const enabledStages = config.stages.filter(stage => stage.enabled);
  const triggers = config.buildTriggers.join(', ');
  
  return `name: CI/CD Pipeline

on:
  ${config.buildTriggers.includes('push') ? 'push:\n    branches: [ ' + config.defaultBranch + ' ]' : ''}
  ${config.buildTriggers.includes('pull_request') ? 'pull_request:\n    branches: [ ' + config.defaultBranch + ' ]' : ''}
  ${config.buildTriggers.includes('schedule') ? 'schedule:\n    - cron: "0 2 * * 1"' : ''}
  ${config.buildTriggers.includes('manual') ? 'workflow_dispatch:' : ''}

jobs:
  ${enabledStages.map(stage => `
  ${stage.id}:
    runs-on: ubuntu-latest
    ${stage.id === 'deploy' ? 'if: github.ref == \'refs/heads/' + config.defaultBranch + '\'' : ''}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      ${stage.id === 'checkout' ? 'with:\n        fetch-depth: ' + (stage.config.fetchDepth || 1) : ''}
    
    ${generateGitHubStageSteps(stage, config)}
  `).join('')}

  deploy:
    needs: [${enabledStages.filter(s => s.id !== 'deploy').map(s => s.id).join(', ')}]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/${config.defaultBranch}'
    
    strategy:
      matrix:
        environment: [${config.environments.map(env => env.name).join(', ')}]
    
    steps:
    - name: Deploy to $\{{ matrix.environment }}
      run: |
        echo "Deploying to $\{{ matrix.environment }}"
        # Add your deployment logic here
`;
}

function generateGitHubStageSteps(stage: PipelineStage, config: CICDConfiguration): string {
  switch (stage.id) {
    case 'install':
      return `    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '${stage.config.nodeVersion || '18'}'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci`;

    case 'lint':
      return `    - name: Run linting
      run: npm run lint
      ${stage.config.failOnError ? '' : 'continue-on-error: true'}`;

    case 'test':
      return `    - name: Run tests
      run: npm test
      ${stage.config.coverage ? '\n    - name: Upload coverage\n      uses: codecov/codecov-action@v3' : ''}`;

    case 'build':
      return `    - name: Build application
      run: npm run build
      env:
        NODE_ENV: production`;

    case 'security':
      return `    - name: Security scan
      uses: securecodewarrior/github-action-add-sarif@v1
      with:
        sarif-file: 'security-scan-results.sarif'`;

    case 'docker':
      return `    - name: Build Docker image
      run: |
        docker build -t $\{{ github.repository }}:$\{{ github.sha }} .
        docker tag $\{{ github.repository }}:$\{{ github.sha }} $\{{ github.repository }}:latest`;

    default:
      return `    - name: ${stage.name}
      run: echo "Executing ${stage.name}"`;
  }
}

/**
 * Generate GitLab CI configuration
 */
function generateGitLabCIConfig(config: CICDConfiguration): string {
  const enabledStages = config.stages.filter(stage => stage.enabled);
  
  return `stages:
  ${enabledStages.map(stage => `- ${stage.id}`).join('\n  ')}

variables:
  NODE_VERSION: "18"
  
${enabledStages.map(stage => `
${stage.id}:
  stage: ${stage.id}
  image: node:$NODE_VERSION
  ${generateGitLabStageScript(stage, config)}
  ${stage.id === 'test' && stage.config.coverage ? 'coverage: /Coverage: \\d+\\.\\d+/' : ''}
`).join('')}

${config.environments.map(env => `
deploy_${env.name}:
  stage: deploy
  script:
    - echo "Deploying to ${env.name}"
    # Add deployment logic here
  environment:
    name: ${env.name}
    ${env.url ? `url: ${env.url}` : ''}
  ${env.type === 'PRODUCTION' ? 'when: manual' : ''}
  ${env.requiresApproval ? 'when: manual' : ''}
`).join('')}`;
}

function generateGitLabStageScript(stage: PipelineStage, config: CICDConfiguration): string {
  switch (stage.id) {
    case 'install':
      return `script:
    - npm ci
  cache:
    paths:
      - node_modules/`;

    case 'lint':
      return `script:
    - npm run lint
  ${stage.config.failOnError ? '' : 'allow_failure: true'}`;

    case 'test':
      return `script:
    - npm test
  artifacts:
    reports:
      ${stage.config.coverage ? 'coverage_report:\n        coverage_format: cobertura\n        path: coverage/cobertura-coverage.xml' : ''}`;

    default:
      return `script:
    - echo "Executing ${stage.name}"`;
  }
}

/**
 * Generate Jenkins pipeline configuration
 */
function generateJenkinsConfig(config: CICDConfiguration): string {
  const enabledStages = config.stages.filter(stage => stage.enabled);
  
  return `pipeline {
    agent any
    
    tools {
        nodejs '${config.stages.find(s => s.id === 'install')?.config.nodeVersion || '18'}'
    }
    
    triggers {
        ${config.buildTriggers.includes('schedule') ? 'cron(\'H 2 * * 1\')' : ''}
        ${config.buildTriggers.includes('push') ? 'githubPush()' : ''}
    }
    
    stages {
        ${enabledStages.map(stage => `
        stage('${stage.name}') {
            steps {
                ${generateJenkinsStageSteps(stage, config)}
            }
            ${stage.config.failOnError === false ? 'post {\n                failure {\n                    echo "Stage failed but continuing"\n                }\n            }' : ''}
        }`).join('')}
        
        ${config.environments.map(env => `
        stage('Deploy to ${env.name}') {
            ${env.requiresApproval ? 'input {\n                message "Deploy to ' + env.name + '?"\n                ok "Deploy"\n            }' : ''}
            steps {
                echo "Deploying to ${env.name}"
                // Add deployment logic here
            }
        }`).join('')}
    }
    
    post {
        always {
            cleanWs()
        }
        failure {
            ${config.notifications.email.length ? `emailext (
                subject: "Pipeline Failed: \${env.JOB_NAME} - \${env.BUILD_NUMBER}",
                body: "Build failed. Check console output at \${env.BUILD_URL}",
                to: "${config.notifications.email.join(', ')}"
            )` : '// Add notification logic here'}
        }
    }
}`;
}

function generateJenkinsStageSteps(stage: PipelineStage, config: CICDConfiguration): string {
  switch (stage.id) {
    case 'checkout':
      return 'checkout scm';
    case 'install':
      return 'sh \'npm ci\'';
    case 'lint':
      return 'sh \'npm run lint\'';
    case 'test':
      return `sh 'npm test'
                ${stage.config.coverage ? 'publishHTML([allowMissing: false, alwaysLinkToLastBuild: true, keepAll: true, reportDir: \'coverage\', reportFiles: \'index.html\', reportName: \'Coverage Report\'])' : ''}`;
    case 'build':
      return 'sh \'npm run build\'';
    default:
      return `echo "Executing ${stage.name}"`;
  }
}

/**
 * Generate Azure DevOps pipeline configuration
 */
function generateAzureDevOpsConfig(config: CICDConfiguration): string {
  const enabledStages = config.stages.filter(stage => stage.enabled);
  
  return `trigger:
  branches:
    include:
    - ${config.defaultBranch}

pr:
  branches:
    include:
    - ${config.defaultBranch}

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '${config.stages.find(s => s.id === 'install')?.config.nodeVersion || '18'}'

stages:
${enabledStages.map(stage => `
- stage: ${stage.id}
  displayName: '${stage.name}'
  jobs:
  - job: ${stage.id}
    steps:
    ${generateAzureStageSteps(stage, config)}
`).join('')}

${config.environments.map(env => `
- stage: Deploy${env.name}
  displayName: 'Deploy to ${env.name}'
  dependsOn: [${enabledStages.map(s => s.id).join(', ')}]
  ${env.type === 'PRODUCTION' ? 'condition: and(succeeded(), eq(variables[\'Build.SourceBranch\'], \'refs/heads/' + config.defaultBranch + '\'))' : ''}
  jobs:
  - deployment: Deploy${env.name}
    environment: '${env.name}'
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "Deploying to ${env.name}"
            displayName: 'Deploy Application'
`).join('')}`;
}

function generateAzureStageSteps(stage: PipelineStage, config: CICDConfiguration): string {
  switch (stage.id) {
    case 'checkout':
      return `    - checkout: self
      fetchDepth: ${stage.config.fetchDepth || 1}`;
    case 'install':
      return `    - task: NodeTool@0
      inputs:
        versionSpec: '\$(nodeVersion)'
      displayName: 'Install Node.js'
    
    - script: npm ci
      displayName: 'Install dependencies'`;
    case 'lint':
      return `    - script: npm run lint
      displayName: 'Run linting'`;
    case 'test':
      return `    - script: npm test
      displayName: 'Run tests'
      
    ${stage.config.coverage ? '- task: PublishCodeCoverageResults@1\n      inputs:\n        codeCoverageTool: Cobertura\n        summaryFileLocation: \'coverage/cobertura-coverage.xml\'' : ''}`;
    default:
      return `    - script: echo "Executing ${stage.name}"
      displayName: '${stage.name}'`;
  }
}

/**
 * Get setup instructions for each provider
 */
function getProviderInstructions(provider: string): string[] {
  switch (provider) {
    case 'github-actions':
      return [
        'Create a .github/workflows directory in your repository root',
        'Save the generated configuration as .github/workflows/ci-cd.yml',
        'Commit and push the workflow file to trigger the first run',
        'Configure any required secrets in repository settings'
      ];
    
    case 'gitlab-ci':
      return [
        'Save the generated configuration as .gitlab-ci.yml in your repository root',
        'Commit and push the file to trigger the first pipeline',
        'Configure GitLab Runner if using self-hosted runners',
        'Set up any required CI/CD variables in project settings'
      ];
    
    case 'jenkins':
      return [
        'Create a new Pipeline job in Jenkins',
        'Configure the job to use "Pipeline script from SCM"',
        'Save the generated configuration as Jenkinsfile in your repository root',
        'Install required Jenkins plugins for your pipeline stages'
      ];
    
    case 'azure-devops':
      return [
        'Save the generated configuration as azure-pipelines.yml',
        'Create a new Pipeline in Azure DevOps',
        'Connect to your repository and select the YAML file',
        'Configure service connections for deployment targets'
      ];
    
    default:
      return ['Follow the provider-specific documentation for setup'];
  }
}