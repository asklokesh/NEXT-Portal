/**
 * Tekton Pipeline Template Generator
 */

import { CICDTemplateConfig, GeneratedTemplate, TemplateMetadata } from '../';
import { BaseTemplateGenerator } from './index';

export class TektonGenerator extends BaseTemplateGenerator {
  getMetadata(): TemplateMetadata {
    return {
      name: 'Tekton Pipeline',
      version: '2.0.0',
      description: 'Cloud-native Tekton CI/CD pipeline for Kubernetes',
      author: 'Platform Team',
      tags: ['tekton', 'kubernetes', 'cloud-native', 'ci/cd'],
      requiredSecrets: [
        'registry-credentials',
        'git-credentials',
        'sonar-token'
      ],
      estimatedDuration: 15,
      costEstimate: {
        compute: 0.0,
        storage: 0.0,
        network: 0.0
      }
    };
  }
  
  generate(config: CICDTemplateConfig): GeneratedTemplate {
    const metadata = this.getMetadata();
    const files = new Map<string, string>();
    
    files.set('tekton/pipeline.yaml', this.generatePipeline(config));
    files.set('tekton/tasks.yaml', this.generateTasks(config));
    files.set('tekton/triggers.yaml', this.generateTriggers(config));
    
    return {
      metadata,
      content: this.generatePipeline(config),
      files,
      documentation: this.generateDocumentation(config)
    };
  }
  
  protected validatePlatformSpecific(config: CICDTemplateConfig): boolean {
    return true;
  }
  
  private generatePipeline(config: CICDTemplateConfig): string {
    return `apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: ${config.projectType}-pipeline
spec:
  params:
    - name: repo-url
      type: string
    - name: revision
      type: string
      default: main
    - name: image-name
      type: string
  
  workspaces:
    - name: shared-workspace
    - name: docker-credentials
  
  tasks:
    - name: fetch-source
      taskRef:
        name: git-clone
      workspaces:
        - name: output
          workspace: shared-workspace
      params:
        - name: url
          value: $(params.repo-url)
        - name: revision
          value: $(params.revision)
    
    - name: build
      taskRef:
        name: ${config.language}-build
      runAfter:
        - fetch-source
      workspaces:
        - name: source
          workspace: shared-workspace
    
    - name: test
      taskRef:
        name: ${config.language}-test
      runAfter:
        - build
      workspaces:
        - name: source
          workspace: shared-workspace
    
    ${config.dockerEnabled ? `- name: build-image
      taskRef:
        name: buildah
      runAfter:
        - test
      workspaces:
        - name: source
          workspace: shared-workspace
        - name: dockerconfig
          workspace: docker-credentials
      params:
        - name: IMAGE
          value: $(params.image-name)` : ''}
    
    ${config.securityScanning ? `- name: security-scan
      taskRef:
        name: trivy-scan
      runAfter:
        - ${config.dockerEnabled ? 'build-image' : 'test'}
      params:
        - name: image
          value: $(params.image-name)` : ''}
    
    ${config.environments ? `- name: deploy
      taskRef:
        name: kubectl-deploy
      runAfter:
        - ${config.securityScanning ? 'security-scan' : config.dockerEnabled ? 'build-image' : 'test'}
      params:
        - name: image
          value: $(params.image-name)` : ''}
`;
  }
  
  private generateTasks(config: CICDTemplateConfig): string {
    return `apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: ${config.language}-build
spec:
  workspaces:
    - name: source
  steps:
    - name: build
      image: ${this.getTaskImage(config.language)}
      workingDir: $(workspaces.source.path)
      script: |
        #!/bin/bash
        ${this.getBuildCommand(config.language)}
---
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: ${config.language}-test
spec:
  workspaces:
    - name: source
  steps:
    - name: unit-test
      image: ${this.getTaskImage(config.language)}
      workingDir: $(workspaces.source.path)
      script: |
        #!/bin/bash
        ${this.getTestCommand(config.language, 'unit')}
`;
  }
  
  private generateTriggers(config: CICDTemplateConfig): string {
    return `apiVersion: triggers.tekton.dev/v1beta1
kind: EventListener
metadata:
  name: ${config.projectType}-listener
spec:
  serviceAccountName: tekton-triggers-sa
  triggers:
    - name: github-push
      interceptors:
        - ref:
            name: github
          params:
            - name: secretRef
              value:
                secretName: github-webhook-secret
                secretKey: token
            - name: eventTypes
              value: ["push", "pull_request"]
      bindings:
        - ref: github-push-binding
      template:
        ref: ${config.projectType}-pipeline-template
---
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerBinding
metadata:
  name: github-push-binding
spec:
  params:
    - name: git-repo-url
      value: $(body.repository.clone_url)
    - name: git-revision
      value: $(body.after)
---
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerTemplate
metadata:
  name: ${config.projectType}-pipeline-template
spec:
  params:
    - name: git-repo-url
    - name: git-revision
  resourcetemplates:
    - apiVersion: tekton.dev/v1beta1
      kind: PipelineRun
      metadata:
        generateName: ${config.projectType}-pipeline-run-
      spec:
        pipelineRef:
          name: ${config.projectType}-pipeline
        params:
          - name: repo-url
            value: $(tt.params.git-repo-url)
          - name: revision
            value: $(tt.params.git-revision)
        workspaces:
          - name: shared-workspace
            volumeClaimTemplate:
              spec:
                accessModes:
                  - ReadWriteOnce
                resources:
                  requests:
                    storage: 1Gi
`;
  }
  
  private getTaskImage(language: string): string {
    const images: Record<string, string> = {
      'nodejs': 'node:20-alpine',
      'python': 'python:3.11-slim',
      'java': 'maven:3.9-openjdk-17',
      'golang': 'golang:1.21-alpine',
      'dotnet': 'mcr.microsoft.com/dotnet/sdk:8.0',
      'rust': 'rust:1.75-slim'
    };
    return images[language] || 'alpine:latest';
  }
  
  private generateDocumentation(config: CICDTemplateConfig): string {
    return `# Tekton Pipeline Documentation

## Overview
Cloud-native CI/CD using Tekton on Kubernetes.

## Components
- **Pipeline**: Main pipeline definition
- **Tasks**: Individual build, test, and deploy tasks
- **Triggers**: GitHub webhook integration
- **EventListener**: Receives webhook events

## Setup
1. Install Tekton Pipelines
2. Apply pipeline resources
3. Configure webhook in GitHub
4. Create required secrets

## Support
Contact the Platform Team for Tekton assistance.`;
  }
}