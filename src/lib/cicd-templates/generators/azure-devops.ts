/**
 * Azure DevOps Pipeline Template Generator
 */

import { CICDTemplateConfig, GeneratedTemplate, TemplateMetadata } from '../';
import { BaseTemplateGenerator } from './index';

export class AzureDevOpsGenerator extends BaseTemplateGenerator {
  getMetadata(): TemplateMetadata {
    return {
      name: 'Azure DevOps Pipeline',
      version: '2.0.0',
      description: 'Production-ready Azure DevOps pipeline with YAML syntax',
      author: 'Platform Team',
      tags: ['azure-devops', 'ci/cd', 'automation'],
      requiredSecrets: [
        'AZURE_REGISTRY_CONNECTION',
        'SONAR_TOKEN',
        'SNYK_TOKEN'
      ],
      estimatedDuration: 20,
      costEstimate: {
        compute: 0.008,
        storage: 0.0,
        network: 0.0
      }
    };
  }
  
  generate(config: CICDTemplateConfig): GeneratedTemplate {
    const metadata = this.getMetadata();
    const files = new Map<string, string>();
    
    const mainPipeline = this.generateAzurePipeline(config);
    files.set('azure-pipelines.yml', mainPipeline);
    
    return {
      metadata,
      content: mainPipeline,
      files,
      documentation: this.generateDocumentation(config)
    };
  }
  
  protected validatePlatformSpecific(config: CICDTemplateConfig): boolean {
    return true;
  }
  
  private generateAzurePipeline(config: CICDTemplateConfig): string {
    return `# Azure DevOps Pipeline
trigger:
  branches:
    include:
      - main
      - develop
      - release/*
  paths:
    exclude:
      - README.md
      - docs/*

pr:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  buildConfiguration: 'Release'
  ${config.dockerEnabled ? `dockerRegistryServiceConnection: 'azure-registry'
  imageRepository: '${config.projectType}-app'
  dockerfilePath: '$(Build.SourcesDirectory)/Dockerfile'
  tag: '$(Build.BuildId)'` : ''}

stages:
- stage: Build
  displayName: 'Build and Test'
  jobs:
  - job: BuildJob
    displayName: 'Build Application'
    steps:
    - task: UseNode@1
      displayName: 'Setup Node.js'
      inputs:
        version: '20.x'
    
    - script: |
        npm ci
        npm run build
      displayName: 'Build'
    
    - task: PublishBuildArtifacts@1
      inputs:
        pathToPublish: '$(Build.ArtifactStagingDirectory)'
        artifactName: 'drop'

- stage: Test
  displayName: 'Run Tests'
  dependsOn: Build
  jobs:
  - job: UnitTests
    displayName: 'Unit Tests'
    steps:
    - script: npm run test:unit
      displayName: 'Run unit tests'
    
    - task: PublishTestResults@2
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: '**/test-results.xml'

${config.dockerEnabled ? `
- stage: Docker
  displayName: 'Build Docker Image'
  dependsOn: Test
  jobs:
  - job: DockerBuild
    displayName: 'Build and Push Image'
    steps:
    - task: Docker@2
      inputs:
        command: 'buildAndPush'
        repository: '$(imageRepository)'
        dockerfile: '$(dockerfilePath)'
        containerRegistry: '$(dockerRegistryServiceConnection)'
        tags: |
          $(tag)
          latest` : ''}

${config.environments ? this.generateDeployStages(config) : ''}
`;
  }
  
  private generateDeployStages(config: CICDTemplateConfig): string {
    return config.environments!.map(env => `
- stage: Deploy_${env.name}
  displayName: 'Deploy to ${env.name}'
  dependsOn: ${config.dockerEnabled ? 'Docker' : 'Test'}
  condition: succeeded()
  jobs:
  - deployment: Deploy${env.name}
    displayName: 'Deploy to ${env.name}'
    environment: '${env.name}'
    strategy:
      runOnce:
        deploy:
          steps:
          - script: |
              echo "Deploying to ${env.name}"
            displayName: 'Deploy'`).join('');
  }
  
  private generateDocumentation(config: CICDTemplateConfig): string {
    return `# Azure DevOps Pipeline Documentation

## Overview
This repository uses Azure DevOps Pipelines for CI/CD.

## Pipeline Configuration
- Trigger: main, develop, release branches
- Pool: Ubuntu latest
- Stages: Build, Test, Docker, Deploy

## Variables
- buildConfiguration: Release
${config.dockerEnabled ? '- Docker registry connection configured' : ''}

## Support
Contact the Platform Team for assistance.`;
  }
}