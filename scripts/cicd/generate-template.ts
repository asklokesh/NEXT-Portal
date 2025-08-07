#!/usr/bin/env node

/**
 * CI/CD Template Generator Script
 * Generates customized CI/CD pipeline templates based on project requirements
 */

import { 
  CICDTemplateConfig,
  TemplateGeneratorFactory,
  TemplateValidator,
  QualityGatePresets,
  templateRegistry
} from '../../src/lib/cicd-templates';
import * as fs from 'fs';
import * as path from 'path';
import * as prompts from 'prompts';

async function main() {
  console.log('🚀 CI/CD Template Generator\n');
  
  // Gather configuration through prompts
  const config = await gatherConfiguration();
  
  // Validate configuration
  console.log('\n📋 Validating configuration...');
  const validator = new TemplateValidator();
  const validationReport = validator.validateConfig(config);
  
  if (!validationReport.valid) {
    console.error('❌ Configuration validation failed:');
    validationReport.errors.forEach(error => {
      console.error(`  - ${error.field}: ${error.message}`);
    });
    process.exit(1);
  }
  
  if (validationReport.warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    validationReport.warnings.forEach(warning => {
      console.warn(`  - ${warning.field}: ${warning.message}`);
      if (warning.suggestion) {
        console.warn(`    💡 ${warning.suggestion}`);
      }
    });
  }
  
  // Generate template
  console.log('\n⚙️  Generating template...');
  const generator = TemplateGeneratorFactory.create(config.platform);
  const template = generator.generate(config);
  
  // Validate generated template
  const templateValidation = validator.validateTemplate(template.content, config.platform);
  if (!templateValidation.valid) {
    console.error('❌ Template validation failed');
    process.exit(1);
  }
  
  // Save template
  const outputPath = await saveTemplate(template, config);
  
  // Register template
  templateRegistry.registerTemplate(
    `${config.platform}-${config.language}-${config.projectType}`,
    template
  );
  
  // Display summary
  console.log('\n✅ Template generated successfully!');
  console.log(`\n📁 Files created:`);
  template.files.forEach((content, filename) => {
    console.log(`  - ${filename}`);
  });
  
  console.log(`\n📊 Quality Score: ${validationReport.score}/100`);
  
  if (validationReport.suggestions.length > 0) {
    console.log('\n💡 Suggestions for improvement:');
    validationReport.suggestions.forEach(suggestion => {
      console.log(`  - ${suggestion}`);
    });
  }
  
  console.log(`\n📚 Documentation: ${outputPath}/README.md`);
  console.log('\n🎉 Your CI/CD pipeline is ready to use!');
}

async function gatherConfiguration(): Promise<CICDTemplateConfig> {
  const questions = [
    {
      type: 'select',
      name: 'platform',
      message: 'Select CI/CD platform',
      choices: [
        { title: 'GitHub Actions', value: 'github-actions' },
        { title: 'GitLab CI', value: 'gitlab-ci' },
        { title: 'Jenkins', value: 'jenkins' },
        { title: 'Azure DevOps', value: 'azure-devops' },
        { title: 'CircleCI', value: 'circleci' },
        { title: 'Tekton', value: 'tekton' }
      ]
    },
    {
      type: 'select',
      name: 'language',
      message: 'Select programming language',
      choices: [
        { title: 'Node.js', value: 'nodejs' },
        { title: 'TypeScript', value: 'typescript' },
        { title: 'Python', value: 'python' },
        { title: 'Java', value: 'java' },
        { title: 'Go', value: 'golang' },
        { title: '.NET', value: 'dotnet' },
        { title: 'Rust', value: 'rust' },
        { title: 'Ruby', value: 'ruby' },
        { title: 'PHP', value: 'php' },
        { title: 'React', value: 'react' }
      ]
    },
    {
      type: 'select',
      name: 'projectType',
      message: 'Select project type',
      choices: [
        { title: 'Service (API/Backend)', value: 'service' },
        { title: 'Library', value: 'library' },
        { title: 'Frontend Application', value: 'frontend' },
        { title: 'Mobile Application', value: 'mobile' },
        { title: 'Infrastructure', value: 'infrastructure' },
        { title: 'Monorepo', value: 'monorepo' }
      ]
    },
    {
      type: 'confirm',
      name: 'dockerEnabled',
      message: 'Enable Docker containerization?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'securityScanning',
      message: 'Enable security scanning?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'performanceTesting',
      message: 'Enable performance testing?',
      initial: false
    },
    {
      type: 'number',
      name: 'coverageThreshold',
      message: 'Minimum code coverage percentage',
      initial: 80,
      min: 0,
      max: 100
    },
    {
      type: 'select',
      name: 'qualityGatePreset',
      message: 'Select quality gates preset',
      choices: [
        { title: 'Strict (90% coverage, low complexity)', value: 'strict' },
        { title: 'Standard (80% coverage, medium complexity)', value: 'standard' },
        { title: 'Relaxed (60% coverage, higher complexity)', value: 'relaxed' },
        { title: 'Minimal (40% coverage, basic checks)', value: 'minimal' },
        { title: 'Custom', value: 'custom' }
      ]
    },
    {
      type: 'multiselect',
      name: 'environments',
      message: 'Select deployment environments',
      choices: [
        { title: 'Development', value: 'development' },
        { title: 'Staging', value: 'staging' },
        { title: 'Production', value: 'production' },
        { title: 'QA', value: 'qa' },
        { title: 'DR (Disaster Recovery)', value: 'dr' }
      ]
    },
    {
      type: 'select',
      name: 'deploymentStrategy',
      message: 'Select deployment strategy',
      choices: [
        { title: 'Rolling Update', value: 'rolling' },
        { title: 'Blue-Green', value: 'blue-green' },
        { title: 'Canary', value: 'canary' },
        { title: 'Feature Flags', value: 'feature-flags' },
        { title: 'Progressive', value: 'progressive' }
      ]
    },
    {
      type: 'confirm',
      name: 'rollbackEnabled',
      message: 'Enable automatic rollback?',
      initial: true
    },
    {
      type: 'multiselect',
      name: 'integrations',
      message: 'Select integrations',
      choices: [
        { title: 'SonarQube', value: 'sonarqube' },
        { title: 'Snyk', value: 'snyk' },
        { title: 'Datadog', value: 'datadog' },
        { title: 'New Relic', value: 'newrelic' },
        { title: 'Sentry', value: 'sentry' },
        { title: 'Jira', value: 'jira' },
        { title: 'Slack', value: 'slack' },
        { title: 'Microsoft Teams', value: 'teams' }
      ]
    }
  ];
  
  const response = await prompts(questions);
  
  // Build configuration object
  const config: CICDTemplateConfig = {
    platform: response.platform,
    language: response.language,
    projectType: response.projectType,
    dockerEnabled: response.dockerEnabled,
    securityScanning: response.securityScanning,
    performanceTesting: response.performanceTesting,
    coverageThreshold: response.coverageThreshold,
    deploymentStrategy: response.deploymentStrategy,
    rollbackEnabled: response.rollbackEnabled,
    caching: true,
    parallelization: true,
    artifactManagement: true,
    conditionalDeployment: true,
    dependencyUpdates: true
  };
  
  // Set quality gates based on preset
  if (response.qualityGatePreset !== 'custom') {
    config.qualityGates = QualityGatePresets[response.qualityGatePreset]();
  } else {
    // Custom quality gates
    const customGates = await prompts([
      {
        type: 'number',
        name: 'codeCoverage',
        message: 'Code coverage threshold (%)',
        initial: 80
      },
      {
        type: 'number',
        name: 'duplicateCode',
        message: 'Maximum duplicate code (%)',
        initial: 5
      },
      {
        type: 'number',
        name: 'complexity',
        message: 'Maximum cyclomatic complexity',
        initial: 10
      }
    ]);
    
    config.qualityGates = customGates;
  }
  
  // Configure environments
  if (response.environments && response.environments.length > 0) {
    config.environments = response.environments.map(env => ({
      name: env,
      type: env,
      url: `https://${env}.example.com`,
      approvalRequired: env === 'production',
      healthChecks: [
        {
          type: 'http',
          endpoint: '/health',
          timeout: 5000,
          interval: 30000,
          retries: 3
        }
      ]
    }));
  }
  
  // Configure integrations
  if (response.integrations && response.integrations.length > 0) {
    config.integrations = {};
    response.integrations.forEach(integration => {
      config.integrations[integration] = true;
    });
  }
  
  // Set testing frameworks based on language
  config.testingFrameworks = getTestingFrameworks(response.language);
  
  return config;
}

function getTestingFrameworks(language: string): string[] {
  const frameworks = {
    'nodejs': ['jest', 'mocha', 'supertest'],
    'typescript': ['jest', 'mocha', 'supertest'],
    'python': ['pytest', 'unittest', 'nose2'],
    'java': ['junit', 'testng', 'mockito'],
    'golang': ['testing', 'testify', 'ginkgo'],
    'dotnet': ['xunit', 'nunit', 'mstest'],
    'rust': ['cargo-test'],
    'ruby': ['rspec', 'minitest'],
    'php': ['phpunit', 'codeception'],
    'react': ['jest', 'react-testing-library', 'cypress']
  };
  
  return frameworks[language] || ['jest'];
}

async function saveTemplate(template: any, config: CICDTemplateConfig): Promise<string> {
  const outputDir = path.join(
    process.cwd(),
    'generated',
    config.platform,
    config.language,
    config.projectType
  );
  
  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Save main template file
  const mainFileName = getMainFileName(config.platform);
  const mainFilePath = path.join(outputDir, mainFileName);
  fs.writeFileSync(mainFilePath, template.content);
  
  // Save additional files
  template.files.forEach((content: string, filename: string) => {
    const filePath = path.join(outputDir, filename);
    const fileDir = path.dirname(filePath);
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(filePath, content);
  });
  
  // Save documentation
  const docPath = path.join(outputDir, 'README.md');
  fs.writeFileSync(docPath, template.documentation);
  
  // Save configuration for reference
  const configPath = path.join(outputDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  return outputDir;
}

function getMainFileName(platform: string): string {
  const fileNames = {
    'github-actions': '.github/workflows/ci-cd.yml',
    'gitlab-ci': '.gitlab-ci.yml',
    'jenkins': 'Jenkinsfile',
    'azure-devops': 'azure-pipelines.yml',
    'circleci': '.circleci/config.yml',
    'tekton': 'tekton/pipeline.yaml'
  };
  
  return fileNames[platform] || 'pipeline.yml';
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});