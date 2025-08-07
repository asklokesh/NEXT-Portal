/**
 * CI/CD Template Library for Backstage Portal
 * Production-ready CI/CD pipeline templates with comprehensive support
 */

export * from './generators';
export * from './validators';
export * from './quality-gates';
export * from './deployment-strategies';

export interface CICDTemplateConfig {
  // Core configuration
  platform: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'azure-devops' | 'tekton' | 'circleci';
  language: 'nodejs' | 'python' | 'java' | 'golang' | 'dotnet' | 'rust' | 'ruby' | 'php' | 'kotlin' | 'swift' | 'scala' | 'elixir' | 'cpp' | 'typescript' | 'react';
  projectType: 'service' | 'library' | 'frontend' | 'mobile' | 'infrastructure' | 'monorepo';
  
  // Build configuration
  buildTool?: string;
  packageManager?: string;
  dockerEnabled?: boolean;
  containerRegistry?: string;
  
  // Testing configuration
  testingFrameworks?: string[];
  coverageThreshold?: number;
  performanceTesting?: boolean;
  securityScanning?: boolean;
  
  // Quality gates
  qualityGates?: {
    codeCoverage?: number;
    duplicateCode?: number;
    complexity?: number;
    maintainability?: string;
    reliability?: string;
    security?: string;
  };
  
  // Deployment configuration
  deploymentStrategy?: 'rolling' | 'blue-green' | 'canary' | 'feature-flags' | 'progressive';
  environments?: Environment[];
  rollbackEnabled?: boolean;
  
  // Integration configuration
  integrations?: {
    sonarqube?: boolean;
    snyk?: boolean;
    datadog?: boolean;
    newRelic?: boolean;
    sentry?: boolean;
    jira?: boolean;
    slack?: boolean;
    teams?: boolean;
  };
  
  // Advanced features
  caching?: boolean;
  parallelization?: boolean;
  matrixBuilds?: boolean;
  conditionalDeployment?: boolean;
  artifactManagement?: boolean;
  dependencyUpdates?: boolean;
}

export interface Environment {
  name: string;
  type: 'development' | 'staging' | 'production' | 'dr' | 'qa';
  url?: string;
  approvalRequired?: boolean;
  autoPromote?: boolean;
  healthChecks?: HealthCheck[];
  secrets?: string[];
}

export interface HealthCheck {
  type: 'http' | 'tcp' | 'grpc' | 'command';
  endpoint?: string;
  port?: number;
  command?: string;
  timeout?: number;
  retries?: number;
  interval?: number;
}

export interface TemplateMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  requiredSecrets?: string[];
  estimatedDuration?: number;
  costEstimate?: {
    compute: number;
    storage: number;
    network: number;
  };
}

export interface GeneratedTemplate {
  metadata: TemplateMetadata;
  content: string;
  files: Map<string, string>;
  documentation: string;
  validationReport?: ValidationReport;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  score: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'critical';
  line?: number;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Template registry for managing CI/CD templates
 */
export class CICDTemplateRegistry {
  private templates: Map<string, GeneratedTemplate> = new Map();
  private validators: Map<string, TemplateValidator> = new Map();
  
  registerTemplate(id: string, template: GeneratedTemplate): void {
    this.templates.set(id, template);
  }
  
  getTemplate(id: string): GeneratedTemplate | undefined {
    return this.templates.get(id);
  }
  
  listTemplates(filter?: Partial<TemplateMetadata>): GeneratedTemplate[] {
    const allTemplates = Array.from(this.templates.values());
    
    if (!filter) return allTemplates;
    
    return allTemplates.filter(template => {
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every(tag => 
          template.metadata.tags.includes(tag)
        );
        if (!hasAllTags) return false;
      }
      
      if (filter.name && !template.metadata.name.includes(filter.name)) {
        return false;
      }
      
      return true;
    });
  }
  
  validateTemplate(template: GeneratedTemplate): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    
    // Validate metadata
    if (!template.metadata.name) {
      errors.push({
        field: 'metadata.name',
        message: 'Template name is required',
        severity: 'error'
      });
    }
    
    if (!template.metadata.version) {
      errors.push({
        field: 'metadata.version',
        message: 'Template version is required',
        severity: 'error'
      });
    }
    
    // Validate content
    if (!template.content || template.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Template content cannot be empty',
        severity: 'critical'
      });
    }
    
    // Calculate score
    let score = 100;
    score -= errors.filter(e => e.severity === 'critical').length * 20;
    score -= errors.filter(e => e.severity === 'error').length * 10;
    score -= warnings.length * 5;
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score: Math.max(0, score)
    };
  }
}

/**
 * Base class for template validators
 */
export abstract class TemplateValidator {
  abstract validate(template: GeneratedTemplate): ValidationReport;
  
  protected checkYAMLSyntax(content: string): ValidationError[] {
    const errors: ValidationError[] = [];
    // Implementation would use a YAML parser
    return errors;
  }
  
  protected checkRequiredFields(
    content: string, 
    requiredFields: string[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const field of requiredFields) {
      if (!content.includes(field)) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          severity: 'error'
        });
      }
    }
    
    return errors;
  }
}

// Export singleton instance
export const templateRegistry = new CICDTemplateRegistry();