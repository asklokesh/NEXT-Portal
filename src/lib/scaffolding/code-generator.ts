/**
 * Code Generation Engine
 * 
 * Generates boilerplate code, API specifications, configuration files,
 * documentation scaffolding, and test structures with patterns.
 */

import { promises as fs } from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { WizardData } from './service-creation-wizard';

export interface CodeGenerationSpec {
  outputPath: string;
  templates: Array<{
    templatePath: string;
    outputPath: string;
    variables: Record<string, any>;
    condition?: (data: WizardData) => boolean;
  }>;
  postProcessors?: Array<{
    name: string;
    config: any;
  }>;
}

export interface GeneratedArtifact {
  path: string;
  content: string;
  type: 'file' | 'directory';
  category: 'source' | 'config' | 'docs' | 'tests' | 'infrastructure';
  language?: string;
  purpose: string;
}

export interface ApiSpecification {
  format: 'openapi' | 'graphql' | 'grpc' | 'asyncapi';
  version: string;
  spec: any;
  endpoints?: Array<{
    path: string;
    method: string;
    description: string;
    parameters: any[];
    responses: any[];
  }>;
}

export interface ConfigurationFile {
  type: 'docker' | 'kubernetes' | 'ci-cd' | 'app-config' | 'database';
  filename: string;
  content: string;
  variables: Record<string, any>;
  environment?: 'development' | 'staging' | 'production' | 'all';
}

export class CodeGenerationEngine {
  private templateCache = new Map<string, string>();
  private generators = new Map<string, CodeGenerator>();
  
  constructor(
    private templateRoot: string,
    private outputRoot: string
  ) {
    this.registerDefaultGenerators();
  }

  /**
   * Generate complete service codebase
   */
  async generateService(wizardData: WizardData): Promise<{
    artifacts: GeneratedArtifact[];
    apiSpecifications: ApiSpecification[];
    configurations: ConfigurationFile[];
    documentation: GeneratedArtifact[];
    tests: GeneratedArtifact[];
    summary: {
      filesGenerated: number;
      linesOfCode: number;
      technologies: string[];
      estimatedSetupTime: string;
    };
  }> {
    const artifacts: GeneratedArtifact[] = [];
    const apiSpecifications: ApiSpecification[] = [];
    const configurations: ConfigurationFile[] = [];
    const documentation: GeneratedArtifact[] = [];
    const tests: GeneratedArtifact[] = [];

    const serviceName = wizardData.serviceBasics?.name || 'new-service';
    const serviceOutputPath = path.join(this.outputRoot, serviceName);

    // Generate service structure
    const structure = await this.generateServiceStructure(wizardData);
    artifacts.push(...structure);

    // Generate source code
    const sourceCode = await this.generateSourceCode(wizardData);
    artifacts.push(...sourceCode);

    // Generate API specifications
    if (wizardData.architecturePattern?.apiStyle) {
      const apiSpecs = await this.generateApiSpecifications(wizardData);
      apiSpecifications.push(...apiSpecs);
    }

    // Generate configuration files
    const configs = await this.generateConfigurations(wizardData);
    configurations.push(...configs);

    // Generate documentation
    const docs = await this.generateDocumentation(wizardData);
    documentation.push(...docs);

    // Generate tests
    const testFiles = await this.generateTests(wizardData);
    tests.push(...testFiles);

    // Calculate summary
    const summary = this.calculateSummary(artifacts, apiSpecifications, configurations, documentation, tests);

    return {
      artifacts,
      apiSpecifications,
      configurations,
      documentation,
      tests,
      summary
    };
  }

  /**
   * Generate API specifications
   */
  async generateApiSpecifications(wizardData: WizardData): Promise<ApiSpecification[]> {
    const specs: ApiSpecification[] = [];
    
    if (!wizardData.architecturePattern?.apiStyle) return specs;

    const generator = this.generators.get(`api-${wizardData.architecturePattern.apiStyle}`);
    if (generator) {
      const spec = await generator.generate(wizardData);
      specs.push(spec as ApiSpecification);
    }

    return specs;
  }

  /**
   * Generate Docker and Kubernetes manifests
   */
  async generateInfrastructureConfigs(wizardData: WizardData): Promise<ConfigurationFile[]> {
    const configs: ConfigurationFile[] = [];

    // Docker configuration
    if (wizardData.deploymentConfiguration?.containerization) {
      const dockerFile = await this.generateDockerfile(wizardData);
      configs.push(dockerFile);

      const dockerCompose = await this.generateDockerCompose(wizardData);
      configs.push(dockerCompose);
    }

    // Kubernetes manifests
    if (wizardData.deploymentConfiguration?.orchestration === 'kubernetes') {
      const k8sManifests = await this.generateKubernetesManifests(wizardData);
      configs.push(...k8sManifests);
    }

    return configs;
  }

  /**
   * Generate CI/CD pipeline configurations
   */
  async generateCiCdConfigs(wizardData: WizardData): Promise<ConfigurationFile[]> {
    const configs: ConfigurationFile[] = [];
    
    if (!wizardData.deploymentConfiguration?.cicdProvider) return configs;

    const generator = this.generators.get(`cicd-${wizardData.deploymentConfiguration.cicdProvider}`);
    if (generator) {
      const pipelineConfig = await generator.generate(wizardData);
      configs.push(pipelineConfig as ConfigurationFile);
    }

    return configs;
  }

  /**
   * Generate monitoring and observability configurations
   */
  async generateMonitoringConfigs(wizardData: WizardData): Promise<ConfigurationFile[]> {
    const configs: ConfigurationFile[] = [];

    if (!wizardData.integrationRequirements?.monitoring) return configs;

    const monitoring = wizardData.integrationRequirements.monitoring;

    // Prometheus configuration
    if (monitoring.metrics) {
      configs.push({
        type: 'app-config',
        filename: 'prometheus.yml',
        content: this.generatePrometheusConfig(wizardData),
        variables: {},
        environment: 'all'
      });
    }

    // Logging configuration
    if (monitoring.logging) {
      configs.push({
        type: 'app-config',
        filename: 'logging.yml',
        content: this.generateLoggingConfig(wizardData),
        variables: {},
        environment: 'all'
      });
    }

    return configs;
  }

  /**
   * Generate test files and structure
   */
  async generateTestSuite(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const tests: GeneratedArtifact[] = [];
    const language = wizardData.technologyStack?.primaryLanguage;
    
    if (!language) return tests;

    const generator = this.generators.get(`tests-${language}`);
    if (generator) {
      const testFiles = await generator.generate(wizardData);
      tests.push(...(testFiles as GeneratedArtifact[]));
    }

    return tests;
  }

  /**
   * Generate service structure
   */
  private async generateServiceStructure(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const structure: GeneratedArtifact[] = [];
    const serviceName = wizardData.serviceBasics?.name || 'new-service';
    const language = wizardData.technologyStack?.primaryLanguage;

    // Base directory structure
    const baseStructure = [
      'src',
      'tests',
      'docs',
      'config',
      'scripts',
      '.github/workflows'
    ];

    for (const dir of baseStructure) {
      structure.push({
        path: path.join(serviceName, dir),
        content: '',
        type: 'directory',
        category: 'source',
        purpose: `${dir.replace(/^\./, '').replace('/', ' ')} directory`
      });
    }

    // Language-specific structure
    if (language === 'javascript' || language === 'typescript') {
      structure.push(
        {
          path: path.join(serviceName, 'src/controllers'),
          content: '',
          type: 'directory',
          category: 'source',
          purpose: 'API controllers'
        },
        {
          path: path.join(serviceName, 'src/services'),
          content: '',
          type: 'directory',
          category: 'source',
          purpose: 'Business logic services'
        },
        {
          path: path.join(serviceName, 'src/models'),
          content: '',
          type: 'directory',
          category: 'source',
          purpose: 'Data models'
        },
        {
          path: path.join(serviceName, 'src/middleware'),
          content: '',
          type: 'directory',
          category: 'source',
          purpose: 'Express middleware'
        },
        {
          path: path.join(serviceName, 'src/utils'),
          content: '',
          type: 'directory',
          category: 'source',
          purpose: 'Utility functions'
        }
      );
    }

    return structure;
  }

  /**
   * Generate source code files
   */
  private async generateSourceCode(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const sourceFiles: GeneratedArtifact[] = [];
    const language = wizardData.technologyStack?.primaryLanguage;
    
    if (!language) return sourceFiles;

    const generator = this.generators.get(`source-${language}`);
    if (generator) {
      const files = await generator.generate(wizardData);
      sourceFiles.push(...(files as GeneratedArtifact[]));
    }

    return sourceFiles;
  }

  /**
   * Generate configuration files
   */
  private async generateConfigurations(wizardData: WizardData): Promise<ConfigurationFile[]> {
    const configs: ConfigurationFile[] = [];

    // Infrastructure configs
    const infraConfigs = await this.generateInfrastructureConfigs(wizardData);
    configs.push(...infraConfigs);

    // CI/CD configs
    const cicdConfigs = await this.generateCiCdConfigs(wizardData);
    configs.push(...cicdConfigs);

    // Monitoring configs
    const monitoringConfigs = await this.generateMonitoringConfigs(wizardData);
    configs.push(...monitoringConfigs);

    // Application configs
    const appConfigs = await this.generateApplicationConfigs(wizardData);
    configs.push(...appConfigs);

    return configs;
  }

  /**
   * Generate application configuration files
   */
  private async generateApplicationConfigs(wizardData: WizardData): Promise<ConfigurationFile[]> {
    const configs: ConfigurationFile[] = [];
    const language = wizardData.technologyStack?.primaryLanguage;

    if (language === 'javascript' || language === 'typescript') {
      // package.json
      configs.push({
        type: 'app-config',
        filename: 'package.json',
        content: this.generatePackageJson(wizardData),
        variables: {},
        environment: 'all'
      });

      // Environment configuration
      configs.push({
        type: 'app-config',
        filename: '.env.example',
        content: this.generateEnvTemplate(wizardData),
        variables: {},
        environment: 'all'
      });
    }

    return configs;
  }

  /**
   * Generate documentation
   */
  private async generateDocumentation(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const docs: GeneratedArtifact[] = [];
    const serviceName = wizardData.serviceBasics?.name || 'new-service';

    // README.md
    docs.push({
      path: path.join(serviceName, 'README.md'),
      content: this.generateReadme(wizardData),
      type: 'file',
      category: 'docs',
      purpose: 'Service documentation'
    });

    // API documentation
    if (wizardData.architecturePattern?.apiStyle) {
      docs.push({
        path: path.join(serviceName, 'docs/api.md'),
        content: this.generateApiDocumentation(wizardData),
        type: 'file',
        category: 'docs',
        purpose: 'API documentation'
      });
    }

    // Architecture documentation
    docs.push({
      path: path.join(serviceName, 'docs/architecture.md'),
      content: this.generateArchitectureDoc(wizardData),
      type: 'file',
      category: 'docs',
      purpose: 'Architecture documentation'
    });

    return docs;
  }

  /**
   * Generate tests
   */
  private async generateTests(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const tests: GeneratedArtifact[] = [];
    const language = wizardData.technologyStack?.primaryLanguage;
    
    if (!language) return tests;

    const testSuite = await this.generateTestSuite(wizardData);
    tests.push(...testSuite);

    return tests;
  }

  /**
   * Generate Dockerfile
   */
  private async generateDockerfile(wizardData: WizardData): Promise<ConfigurationFile> {
    const language = wizardData.technologyStack?.primaryLanguage;
    let content = '';

    switch (language) {
      case 'javascript':
      case 'typescript':
        content = this.generateNodeDockerfile(wizardData);
        break;
      case 'python':
        content = this.generatePythonDockerfile(wizardData);
        break;
      case 'java':
        content = this.generateJavaDockerfile(wizardData);
        break;
      default:
        content = this.generateGenericDockerfile(wizardData);
    }

    return {
      type: 'docker',
      filename: 'Dockerfile',
      content,
      variables: {},
      environment: 'all'
    };
  }

  /**
   * Generate Docker Compose file
   */
  private async generateDockerCompose(wizardData: WizardData): Promise<ConfigurationFile> {
    const serviceName = wizardData.serviceBasics?.name || 'new-service';
    const database = wizardData.technologyStack?.database;

    const compose = {
      version: '3.8',
      services: {
        [serviceName]: {
          build: '.',
          ports: ['3000:3000'],
          environment: {
            NODE_ENV: 'development'
          },
          depends_on: database ? [database] : []
        }
      }
    };

    if (database === 'postgresql') {
      compose.services.postgres = {
        image: 'postgres:15',
        environment: {
          POSTGRES_DB: serviceName,
          POSTGRES_USER: 'user',
          POSTGRES_PASSWORD: 'password'
        },
        ports: ['5432:5432']
      };
    } else if (database === 'mongodb') {
      compose.services.mongo = {
        image: 'mongo:6',
        ports: ['27017:27017']
      };
    }

    return {
      type: 'docker',
      filename: 'docker-compose.yml',
      content: yaml.dump(compose),
      variables: {},
      environment: 'development'
    };
  }

  /**
   * Generate Kubernetes manifests
   */
  private async generateKubernetesManifests(wizardData: WizardData): Promise<ConfigurationFile[]> {
    const configs: ConfigurationFile[] = [];
    const serviceName = wizardData.serviceBasics?.name || 'new-service';

    // Deployment
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: serviceName,
        labels: {
          app: serviceName
        }
      },
      spec: {
        replicas: 3,
        selector: {
          matchLabels: {
            app: serviceName
          }
        },
        template: {
          metadata: {
            labels: {
              app: serviceName
            }
          },
          spec: {
            containers: [{
              name: serviceName,
              image: `${serviceName}:latest`,
              ports: [{
                containerPort: 3000
              }],
              env: [{
                name: 'NODE_ENV',
                value: 'production'
              }]
            }]
          }
        }
      }
    };

    configs.push({
      type: 'kubernetes',
      filename: 'deployment.yaml',
      content: yaml.dump(deployment),
      variables: {},
      environment: 'production'
    });

    // Service
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName
      },
      spec: {
        selector: {
          app: serviceName
        },
        ports: [{
          port: 80,
          targetPort: 3000
        }],
        type: 'ClusterIP'
      }
    };

    configs.push({
      type: 'kubernetes',
      filename: 'service.yaml',
      content: yaml.dump(service),
      variables: {},
      environment: 'production'
    });

    return configs;
  }

  /**
   * Generate Node.js Dockerfile
   */
  private generateNodeDockerfile(wizardData: WizardData): string {
    const language = wizardData.technologyStack?.primaryLanguage;
    const nodeVersion = language === 'typescript' ? '18' : '18';
    
    return `FROM node:${nodeVersion}-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build if TypeScript
${language === 'typescript' ? 'RUN npm run build' : ''}

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node healthcheck.js

# Start application
CMD ${language === 'typescript' ? '["node", "dist/index.js"]' : '["node", "src/index.js"]'}
`;
  }

  /**
   * Generate Python Dockerfile
   */
  private generatePythonDockerfile(wizardData: WizardData): string {
    return `FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD python healthcheck.py

# Start application
CMD ["python", "main.py"]
`;
  }

  /**
   * Generate Java Dockerfile
   */
  private generateJavaDockerfile(wizardData: WizardData): string {
    return `FROM openjdk:17-jre-slim

WORKDIR /app

# Copy JAR file
COPY target/*.jar app.jar

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

# Start application
ENTRYPOINT ["java", "-jar", "app.jar"]
`;
  }

  /**
   * Generate generic Dockerfile
   */
  private generateGenericDockerfile(wizardData: WizardData): string {
    return `# Multi-stage build
FROM alpine:latest

WORKDIR /app

# Add application files
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["./start.sh"]
`;
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(wizardData: WizardData): string {
    const serviceName = wizardData.serviceBasics?.name || 'new-service';
    const description = wizardData.serviceBasics?.description || 'Generated service';
    const language = wizardData.technologyStack?.primaryLanguage;
    const framework = wizardData.technologyStack?.framework;

    const packageJson = {
      name: serviceName,
      version: '1.0.0',
      description,
      main: language === 'typescript' ? 'dist/index.js' : 'src/index.js',
      scripts: {
        start: language === 'typescript' ? 'node dist/index.js' : 'node src/index.js',
        dev: language === 'typescript' ? 'ts-node-dev src/index.ts' : 'nodemon src/index.js',
        build: language === 'typescript' ? 'tsc' : '',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        lint: 'eslint src/',
        'lint:fix': 'eslint src/ --fix'
      },
      dependencies: this.generateDependencies(wizardData),
      devDependencies: this.generateDevDependencies(wizardData)
    };

    return JSON.stringify(packageJson, null, 2);
  }

  /**
   * Generate dependencies based on wizard data
   */
  private generateDependencies(wizardData: WizardData): Record<string, string> {
    const deps: Record<string, string> = {};
    const framework = wizardData.technologyStack?.framework;
    const database = wizardData.technologyStack?.database;

    // Framework dependencies
    if (framework === 'express') {
      deps.express = '^4.18.0';
      deps.cors = '^2.8.5';
      deps.helmet = '^6.0.1';
    } else if (framework === 'nestjs') {
      deps['@nestjs/core'] = '^9.0.0';
      deps['@nestjs/common'] = '^9.0.0';
      deps['@nestjs/platform-express'] = '^9.0.0';
    }

    // Database dependencies
    if (database === 'postgresql') {
      deps.pg = '^8.8.0';
    } else if (database === 'mongodb') {
      deps.mongoose = '^6.8.0';
    }

    // Monitoring dependencies
    if (wizardData.integrationRequirements?.monitoring?.metrics) {
      deps['prom-client'] = '^14.0.0';
    }

    if (wizardData.integrationRequirements?.monitoring?.logging) {
      deps.winston = '^3.8.0';
    }

    // Security dependencies
    if (wizardData.integrationRequirements?.security?.authentication) {
      deps.jsonwebtoken = '^8.5.1';
      deps.bcrypt = '^5.1.0';
    }

    return deps;
  }

  /**
   * Generate dev dependencies
   */
  private generateDevDependencies(wizardData: WizardData): Record<string, string> {
    const devDeps: Record<string, string> = {};
    const language = wizardData.technologyStack?.primaryLanguage;

    // Base dev dependencies
    devDeps.jest = '^29.0.0';
    devDeps.eslint = '^8.30.0';
    devDeps.prettier = '^2.8.0';

    if (language === 'typescript') {
      devDeps.typescript = '^4.9.0';
      devDeps['ts-node-dev'] = '^2.0.0';
      devDeps['@types/node'] = '^18.11.0';
      devDeps['@types/jest'] = '^29.0.0';
    } else {
      devDeps.nodemon = '^2.0.0';
    }

    return devDeps;
  }

  /**
   * Generate environment template
   */
  private generateEnvTemplate(wizardData: WizardData): string {
    const lines = [
      '# Environment Configuration',
      '# Copy this file to .env and update values',
      '',
      'NODE_ENV=development',
      'PORT=3000',
      ''
    ];

    // Database configuration
    if (wizardData.technologyStack?.database === 'postgresql') {
      lines.push(
        '# Database',
        'DB_HOST=localhost',
        'DB_PORT=5432',
        'DB_NAME=' + (wizardData.serviceBasics?.name || 'service_db'),
        'DB_USER=user',
        'DB_PASSWORD=password',
        ''
      );
    }

    // Authentication configuration
    if (wizardData.integrationRequirements?.security?.authentication) {
      lines.push(
        '# Authentication',
        'JWT_SECRET=your-secret-key',
        'JWT_EXPIRES_IN=24h',
        ''
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate README.md
   */
  private generateReadme(wizardData: WizardData): string {
    const serviceName = wizardData.serviceBasics?.displayName || wizardData.serviceBasics?.name || 'Service';
    const description = wizardData.serviceBasics?.description || 'Generated service';
    const owner = wizardData.serviceBasics?.owner || 'Team';
    
    return `# ${serviceName}

${description}

## Owner
${owner}

## Architecture
- **Pattern**: ${wizardData.architecturePattern?.pattern || 'N/A'}
- **API Style**: ${wizardData.architecturePattern?.apiStyle || 'N/A'}
- **Technology Stack**: ${wizardData.technologyStack?.primaryLanguage || 'N/A'}

## Getting Started

### Prerequisites
- Node.js 18+
- ${wizardData.technologyStack?.database || 'Database'}

### Installation
\`\`\`bash
npm install
\`\`\`

### Development
\`\`\`bash
npm run dev
\`\`\`

### Testing
\`\`\`bash
npm test
\`\`\`

### Building
\`\`\`bash
npm run build
\`\`\`

## API Documentation
See [API Documentation](docs/api.md) for detailed API reference.

## Contributing
Please read our contributing guidelines before submitting pull requests.

## License
MIT
`;
  }

  /**
   * Generate API documentation
   */
  private generateApiDocumentation(wizardData: WizardData): string {
    const serviceName = wizardData.serviceBasics?.displayName || 'Service';
    
    return `# ${serviceName} API Documentation

## Overview
This document describes the API endpoints for ${serviceName}.

## Base URL
\`\`\`
http://localhost:3000/api/v1
\`\`\`

## Authentication
${wizardData.integrationRequirements?.security?.authentication ? 
  'This API uses JWT authentication. Include the token in the Authorization header.' : 
  'This API does not require authentication.'}

## Endpoints

### Health Check
\`\`\`
GET /health
\`\`\`

Returns the service health status.

**Response:**
\`\`\`json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`

## Error Handling
All errors follow this format:
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
\`\`\`
`;
  }

  /**
   * Generate architecture documentation
   */
  private generateArchitectureDoc(wizardData: WizardData): string {
    return `# Architecture Documentation

## Overview
This service follows ${wizardData.architecturePattern?.pattern || 'standard'} architecture pattern.

## Technology Stack
- **Language**: ${wizardData.technologyStack?.primaryLanguage || 'N/A'}
- **Framework**: ${wizardData.technologyStack?.framework || 'N/A'}  
- **Database**: ${wizardData.technologyStack?.database || 'N/A'}

## Service Dependencies
${wizardData.integrationRequirements?.internalServices?.length ? 
  wizardData.integrationRequirements.internalServices.map(s => `- ${s}`).join('\n') : 
  'None'}

## External APIs
${wizardData.integrationRequirements?.externalApis?.length ? 
  wizardData.integrationRequirements.externalApis.map(api => `- ${api.name}: ${api.type}`).join('\n') : 
  'None'}

## Security Considerations
${wizardData.integrationRequirements?.security?.authentication ? 
  '- Authentication required\n' : ''}${wizardData.integrationRequirements?.security?.encryption ? 
  '- Data encryption enabled\n' : ''}

## Monitoring
${wizardData.integrationRequirements?.monitoring?.metrics ? 
  '- Metrics collection enabled\n' : ''}${wizardData.integrationRequirements?.monitoring?.logging ? 
  '- Structured logging\n' : ''}
`;
  }

  /**
   * Generate Prometheus configuration
   */
  private generatePrometheusConfig(wizardData: WizardData): string {
    const serviceName = wizardData.serviceBasics?.name || 'service';
    
    return `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: '${serviceName}'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
`;
  }

  /**
   * Generate logging configuration
   */
  private generateLoggingConfig(wizardData: WizardData): string {
    return `level: info
format: json
transports:
  - type: console
  - type: file
    filename: logs/app.log
    maxSize: 100MB
    maxFiles: 5
`;
  }

  /**
   * Calculate generation summary
   */
  private calculateSummary(
    artifacts: GeneratedArtifact[],
    apiSpecs: ApiSpecification[],
    configs: ConfigurationFile[],
    docs: GeneratedArtifact[],
    tests: GeneratedArtifact[]
  ): any {
    const allFiles = [...artifacts, ...docs, ...tests];
    const filesGenerated = allFiles.filter(f => f.type === 'file').length + configs.length;
    
    let linesOfCode = 0;
    for (const file of allFiles) {
      if (file.type === 'file' && file.category === 'source') {
        linesOfCode += file.content.split('\n').length;
      }
    }

    const technologies = new Set<string>();
    technologies.add('Docker'); // Always included
    
    return {
      filesGenerated,
      linesOfCode,
      technologies: Array.from(technologies),
      estimatedSetupTime: '15-30 minutes'
    };
  }

  /**
   * Register default generators
   */
  private registerDefaultGenerators(): void {
    // Register language-specific generators
    this.generators.set('source-javascript', new JavaScriptGenerator());
    this.generators.set('source-typescript', new TypeScriptGenerator());
    this.generators.set('source-python', new PythonGenerator());
    
    // Register API generators
    this.generators.set('api-rest', new RestApiGenerator());
    this.generators.set('api-graphql', new GraphQLGenerator());
    
    // Register CI/CD generators
    this.generators.set('cicd-github-actions', new GitHubActionsGenerator());
    this.generators.set('cicd-gitlab-ci', new GitLabCIGenerator());
  }
}

// Generator interfaces and implementations
interface CodeGenerator {
  generate(wizardData: WizardData): Promise<any>;
}

class JavaScriptGenerator implements CodeGenerator {
  async generate(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];
    const serviceName = wizardData.serviceBasics?.name || 'service';
    
    // Main application file
    artifacts.push({
      path: `${serviceName}/src/index.js`,
      content: this.generateMainFile(wizardData),
      type: 'file',
      category: 'source',
      language: 'javascript',
      purpose: 'Main application entry point'
    });

    return artifacts;
  }

  private generateMainFile(wizardData: WizardData): string {
    const framework = wizardData.technologyStack?.framework;
    
    if (framework === 'express') {
      return `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${wizardData.serviceBasics?.displayName || 'Service'}' });
});

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

module.exports = app;
`;
    }
    
    return '// Generated service entry point\nconsole.log("Service started");';
  }
}

class TypeScriptGenerator implements CodeGenerator {
  async generate(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];
    const serviceName = wizardData.serviceBasics?.name || 'service';
    
    // TypeScript main file
    artifacts.push({
      path: `${serviceName}/src/index.ts`,
      content: this.generateMainFile(wizardData),
      type: 'file',
      category: 'source',
      language: 'typescript',
      purpose: 'Main application entry point'
    });

    // TypeScript configuration
    artifacts.push({
      path: `${serviceName}/tsconfig.json`,
      content: this.generateTsConfig(),
      type: 'file',
      category: 'config',
      purpose: 'TypeScript configuration'
    });

    return artifacts;
  }

  private generateMainFile(wizardData: WizardData): string {
    return `import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to ${wizardData.serviceBasics?.displayName || 'Service'}' });
});

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

export default app;
`;
  }

  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    }, null, 2);
  }
}

class PythonGenerator implements CodeGenerator {
  async generate(wizardData: WizardData): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];
    const serviceName = wizardData.serviceBasics?.name || 'service';
    
    artifacts.push({
      path: `${serviceName}/main.py`,
      content: this.generateMainFile(wizardData),
      type: 'file',
      category: 'source',
      language: 'python',
      purpose: 'Main application entry point'
    });

    return artifacts;
  }

  private generateMainFile(wizardData: WizardData): string {
    return `from fastapi import FastAPI
from datetime import datetime

app = FastAPI(title="${wizardData.serviceBasics?.displayName || 'Service'}")

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/")
async def root():
    return {"message": "Welcome to ${wizardData.serviceBasics?.displayName || 'Service'}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
  }
}

class RestApiGenerator implements CodeGenerator {
  async generate(wizardData: WizardData): Promise<ApiSpecification> {
    const serviceName = wizardData.serviceBasics?.name || 'service';
    
    const spec = {
      openapi: '3.0.0',
      info: {
        title: wizardData.serviceBasics?.displayName || 'Service API',
        description: wizardData.serviceBasics?.description || 'Generated service API',
        version: '1.0.0'
      },
      servers: [
        { url: 'http://localhost:3000/api/v1', description: 'Development server' }
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health check',
            responses: {
              '200': {
                description: 'Service is healthy',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string' },
                        timestamp: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    return {
      format: 'openapi',
      version: '3.0.0',
      spec
    };
  }
}

class GraphQLGenerator implements CodeGenerator {
  async generate(wizardData: WizardData): Promise<ApiSpecification> {
    const schema = `
type Query {
  health: HealthStatus!
  service: ServiceInfo!
}

type HealthStatus {
  status: String!
  timestamp: String!
}

type ServiceInfo {
  name: String!
  version: String!
  description: String
}
`;

    return {
      format: 'graphql',
      version: '1.0.0',
      spec: { schema }
    };
  }
}

class GitHubActionsGenerator implements CodeGenerator {
  async generate(wizardData: WizardData): Promise<ConfigurationFile> {
    const workflow = {
      name: 'CI/CD',
      on: {
        push: { branches: ['main', 'develop'] },
        pull_request: { branches: ['main'] }
      },
      jobs: {
        test: {
          'runs-on': 'ubuntu-latest',
          steps: [
            { uses: 'actions/checkout@v3' },
            {
              uses: 'actions/setup-node@v3',
              with: { 'node-version': '18' }
            },
            { run: 'npm ci' },
            { run: 'npm run test' },
            { run: 'npm run build' }
          ]
        }
      }
    };

    return {
      type: 'ci-cd',
      filename: '.github/workflows/ci.yml',
      content: yaml.dump(workflow),
      variables: {},
      environment: 'all'
    };
  }
}

class GitLabCIGenerator implements CodeGenerator {
  async generate(wizardData: WizardData): Promise<ConfigurationFile> {
    const pipeline = {
      stages: ['test', 'build', 'deploy'],
      image: 'node:18',
      test: {
        stage: 'test',
        script: ['npm ci', 'npm run test']
      },
      build: {
        stage: 'build',
        script: ['npm run build']
      }
    };

    return {
      type: 'ci-cd',
      filename: '.gitlab-ci.yml',
      content: yaml.dump(pipeline),
      variables: {},
      environment: 'all'
    };
  }
}