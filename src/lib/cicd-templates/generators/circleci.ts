/**
 * CircleCI Pipeline Template Generator
 */

import { CICDTemplateConfig, GeneratedTemplate, TemplateMetadata } from '../';
import { BaseTemplateGenerator } from './index';

export class CircleCIGenerator extends BaseTemplateGenerator {
  getMetadata(): TemplateMetadata {
    return {
      name: 'CircleCI Pipeline',
      version: '2.0.0',
      description: 'Production-ready CircleCI configuration',
      author: 'Platform Team',
      tags: ['circleci', 'ci/cd', 'automation'],
      requiredSecrets: [
        'DOCKER_USER',
        'DOCKER_PASS',
        'SONAR_TOKEN',
        'SNYK_TOKEN'
      ],
      estimatedDuration: 12,
      costEstimate: {
        compute: 0.01,
        storage: 0.0,
        network: 0.0
      }
    };
  }
  
  generate(config: CICDTemplateConfig): GeneratedTemplate {
    const metadata = this.getMetadata();
    const files = new Map<string, string>();
    
    const circleConfig = this.generateCircleConfig(config);
    files.set('.circleci/config.yml', circleConfig);
    
    return {
      metadata,
      content: circleConfig,
      files,
      documentation: this.generateDocumentation(config)
    };
  }
  
  protected validatePlatformSpecific(config: CICDTemplateConfig): boolean {
    return true;
  }
  
  private generateCircleConfig(config: CICDTemplateConfig): string {
    return `version: 2.1

orbs:
  node: circleci/node@5.1.0
  docker: circleci/docker@2.2.0
  ${config.integrations?.snyk ? 'snyk: snyk/snyk@1.4.0' : ''}
  ${config.integrations?.sonarqube ? 'sonarcloud: sonarsource/sonarcloud@1.1.1' : ''}

executors:
  default:
    docker:
      - image: cimg/${this.getCircleImage(config.language)}
    working_directory: ~/repo

commands:
  restore_deps:
    steps:
      - restore_cache:
          keys:
            - v1-deps-{{ checksum "${this.getLockFile(config.language)}" }}
            - v1-deps-
  
  save_deps:
    steps:
      - save_cache:
          key: v1-deps-{{ checksum "${this.getLockFile(config.language)}" }}
          paths:
            - ${this.getCachePath(config.language)}

jobs:
  build:
    executor: default
    steps:
      - checkout
      - restore_deps
      - run:
          name: Install dependencies
          command: ${this.getInstallCommand(config.language)}
      - save_deps
      - run:
          name: Build application
          command: ${this.getBuildCommand(config.language)}
      - persist_to_workspace:
          root: .
          paths:
            - ${this.getBuildArtifacts(config.language)}
  
  test-unit:
    executor: default
    steps:
      - checkout
      - restore_deps
      - attach_workspace:
          at: .
      - run:
          name: Run unit tests
          command: ${this.getTestCommand(config.language, 'unit')}
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage
  
  test-integration:
    executor: default
    docker:
      - image: cimg/${this.getCircleImage(config.language)}
      - image: cimg/postgres:15.0
        environment:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
      - image: cimg/redis:7.0
    steps:
      - checkout
      - restore_deps
      - attach_workspace:
          at: .
      - run:
          name: Wait for services
          command: |
            dockerize -wait tcp://localhost:5432 -timeout 1m
            dockerize -wait tcp://localhost:6379 -timeout 1m
      - run:
          name: Run integration tests
          command: ${this.getTestCommand(config.language, 'integration')}
      - store_test_results:
          path: test-results
  
  ${config.securityScanning ? `security-scan:
    executor: default
    steps:
      - checkout
      - restore_deps
      - run:
          name: Security scan
          command: ${this.getDependencyScanCommand(config.language)}
      ${config.integrations?.snyk ? `- snyk/scan:
          severity-threshold: high` : ''}` : ''}
  
  ${config.qualityGates ? `quality-check:
    executor: default
    steps:
      - checkout
      - restore_deps
      - attach_workspace:
          at: .
      - run:
          name: Check quality gates
          command: |
            COVERAGE=$(cat coverage/coverage.json | jq .total)
            if [ "$COVERAGE" -lt "${config.qualityGates.codeCoverage || 80}" ]; then
              echo "Coverage below threshold"
              exit 1
            fi
      ${config.integrations?.sonarqube ? `- sonarcloud/scan` : ''}` : ''}
  
  ${config.dockerEnabled ? `build-docker:
    executor: docker/docker
    steps:
      - setup_remote_docker:
          docker_layer_caching: true
      - checkout
      - attach_workspace:
          at: .
      - docker/build:
          image: $CIRCLE_PROJECT_REPONAME
          tag: $CIRCLE_SHA1,latest
      - docker/push:
          image: $CIRCLE_PROJECT_REPONAME
          tag: $CIRCLE_SHA1,latest` : ''}
  
  ${config.environments ? this.generateDeployJobs(config) : ''}

workflows:
  version: 2
  build-test-deploy:
    jobs:
      - build
      - test-unit:
          requires:
            - build
      - test-integration:
          requires:
            - build
      ${config.securityScanning ? `- security-scan:
          requires:
            - build` : ''}
      ${config.qualityGates ? `- quality-check:
          requires:
            - test-unit
            - test-integration` : ''}
      ${config.dockerEnabled ? `- build-docker:
          requires:
            - test-unit
            - test-integration
          filters:
            branches:
              only:
                - main
                - develop` : ''}
      ${config.environments ? this.generateWorkflowDeploy(config) : ''}
  
  nightly:
    triggers:
      - schedule:
          cron: "0 0 * * *"
          filters:
            branches:
              only:
                - main
    jobs:
      - build
      - security-scan:
          requires:
            - build
`;
  }
  
  private generateDeployJobs(config: CICDTemplateConfig): string {
    return config.environments!.map(env => `
  deploy-${env.name}:
    executor: default
    steps:
      - checkout
      - attach_workspace:
          at: .
      - run:
          name: Deploy to ${env.name}
          command: |
            echo "Deploying to ${env.name}"
            # Add deployment commands here`).join('');
  }
  
  private generateWorkflowDeploy(config: CICDTemplateConfig): string {
    return config.environments!.map(env => `
      - deploy-${env.name}:
          requires:
            ${config.dockerEnabled ? '- build-docker' : '- quality-check'}
          ${env.approvalRequired ? `type: approval
          ` : ''}filters:
            branches:
              only: ${this.getDeployBranch(env)}`).join('');
  }
  
  private getCircleImage(language: string): string {
    const images: Record<string, string> = {
      'nodejs': 'node:20.9',
      'python': 'python:3.11',
      'java': 'openjdk:17.0',
      'golang': 'go:1.21',
      'rust': 'rust:1.75',
      'ruby': 'ruby:3.2',
      'php': 'php:8.2'
    };
    return images[language] || 'base:2023.10';
  }
  
  private getDeployBranch(env: any): string {
    const branches: Record<string, string> = {
      'production': 'main',
      'staging': 'staging',
      'development': 'develop'
    };
    return branches[env.type] || 'develop';
  }
  
  private generateDocumentation(config: CICDTemplateConfig): string {
    return `# CircleCI Configuration Documentation

## Overview
This repository uses CircleCI for continuous integration and deployment.

## Configuration Structure
- **Version**: 2.1
- **Orbs**: Reusable configuration packages
- **Executors**: Execution environments
- **Commands**: Reusable command sequences
- **Jobs**: Individual tasks
- **Workflows**: Job orchestration

## Jobs
- **build**: Build application
- **test-unit**: Run unit tests
- **test-integration**: Run integration tests with services
${config.securityScanning ? '- **security-scan**: Security vulnerability scanning' : ''}
${config.qualityGates ? '- **quality-check**: Code quality gates' : ''}
${config.dockerEnabled ? '- **build-docker**: Build and push Docker image' : ''}
${config.environments ? config.environments.map(env => `- **deploy-${env.name}**: Deploy to ${env.name}`).join('\\n') : ''}

## Workflows
- **build-test-deploy**: Main CI/CD workflow
- **nightly**: Scheduled security scans

## Caching
- Dependencies cached by lock file checksum
- Docker layer caching enabled

## Support
Contact the Platform Team for CircleCI assistance.`;
  }
}