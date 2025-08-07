/**
 * CI/CD Template Validators
 * Validates CI/CD configurations and templates
 */

import { CICDTemplateConfig, ValidationReport, ValidationError, ValidationWarning } from '../';

export interface ValidatorRule {
  name: string;
  description: string;
  validate: (config: CICDTemplateConfig) => ValidationResult;
}

export interface ValidationResult {
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  suggestions?: string[];
}

/**
 * Configuration Validator
 */
export class ConfigurationValidator {
  private rules: ValidatorRule[] = [];
  
  constructor() {
    this.initializeRules();
  }
  
  private initializeRules(): void {
    // Required fields validation
    this.addRule({
      name: 'required-fields',
      description: 'Validates required configuration fields',
      validate: (config) => {
        const errors: ValidationError[] = [];
        
        if (!config.platform) {
          errors.push({
            field: 'platform',
            message: 'CI/CD platform is required',
            severity: 'critical'
          });
        }
        
        if (!config.language) {
          errors.push({
            field: 'language',
            message: 'Programming language is required',
            severity: 'critical'
          });
        }
        
        if (!config.projectType) {
          errors.push({
            field: 'projectType',
            message: 'Project type is required',
            severity: 'critical'
          });
        }
        
        return { errors };
      }
    });
    
    // Platform compatibility validation
    this.addRule({
      name: 'platform-compatibility',
      description: 'Validates platform-specific requirements',
      validate: (config) => {
        const warnings: ValidationWarning[] = [];
        const suggestions: string[] = [];
        
        if (config.platform === 'github-actions' && config.parallelization) {
          suggestions.push('GitHub Actions supports matrix builds for parallelization');
        }
        
        if (config.platform === 'jenkins' && !config.dockerEnabled) {
          warnings.push({
            field: 'dockerEnabled',
            message: 'Consider enabling Docker for better Jenkins agent management',
            suggestion: 'Set dockerEnabled: true for containerized builds'
          });
        }
        
        if (config.platform === 'gitlab-ci' && config.environments?.length > 10) {
          warnings.push({
            field: 'environments',
            message: 'Large number of environments may slow down GitLab CI',
            suggestion: 'Consider using dynamic environments or environment templates'
          });
        }
        
        return { warnings, suggestions };
      }
    });
    
    // Language-specific validation
    this.addRule({
      name: 'language-requirements',
      description: 'Validates language-specific configurations',
      validate: (config) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        
        // Node.js specific
        if (['nodejs', 'typescript', 'react'].includes(config.language)) {
          if (!config.packageManager) {
            warnings.push({
              field: 'packageManager',
              message: 'Package manager not specified',
              suggestion: 'Specify npm, yarn, or pnpm for better dependency management'
            });
          }
          
          if (!config.caching) {
            warnings.push({
              field: 'caching',
              message: 'Dependency caching not enabled',
              suggestion: 'Enable caching to speed up builds'
            });
          }
        }
        
        // Java specific
        if (config.language === 'java' && !config.buildTool) {
          errors.push({
            field: 'buildTool',
            message: 'Build tool is required for Java projects',
            severity: 'error'
          });
        }
        
        // Python specific
        if (config.language === 'python' && config.projectType === 'service') {
          if (!config.dockerEnabled) {
            warnings.push({
              field: 'dockerEnabled',
              message: 'Consider containerizing Python services',
              suggestion: 'Enable Docker for consistent deployments'
            });
          }
        }
        
        return { errors, warnings };
      }
    });
    
    // Testing configuration validation
    this.addRule({
      name: 'testing-configuration',
      description: 'Validates testing setup',
      validate: (config) => {
        const warnings: ValidationWarning[] = [];
        const suggestions: string[] = [];
        
        if (!config.testingFrameworks || config.testingFrameworks.length === 0) {
          warnings.push({
            field: 'testingFrameworks',
            message: 'No testing frameworks configured',
            suggestion: 'Add unit and integration testing frameworks'
          });
        }
        
        if (config.coverageThreshold && config.coverageThreshold < 60) {
          warnings.push({
            field: 'coverageThreshold',
            message: `Coverage threshold ${config.coverageThreshold}% is low`,
            suggestion: 'Consider increasing coverage threshold to at least 70%'
          });
        }
        
        if (config.projectType === 'frontend' && !config.performanceTesting) {
          suggestions.push('Consider enabling performance testing for frontend projects');
        }
        
        return { warnings, suggestions };
      }
    });
    
    // Security validation
    this.addRule({
      name: 'security-configuration',
      description: 'Validates security settings',
      validate: (config) => {
        const warnings: ValidationWarning[] = [];
        const suggestions: string[] = [];
        
        if (!config.securityScanning) {
          warnings.push({
            field: 'securityScanning',
            message: 'Security scanning is disabled',
            suggestion: 'Enable security scanning to detect vulnerabilities'
          });
        }
        
        if (config.dockerEnabled && !config.integrations?.snyk) {
          suggestions.push('Consider integrating Snyk for container security scanning');
        }
        
        if (!config.dependencyUpdates) {
          warnings.push({
            field: 'dependencyUpdates',
            message: 'Automated dependency updates not configured',
            suggestion: 'Enable dependency updates to stay secure'
          });
        }
        
        return { warnings, suggestions };
      }
    });
    
    // Deployment validation
    this.addRule({
      name: 'deployment-configuration',
      description: 'Validates deployment setup',
      validate: (config) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const suggestions: string[] = [];
        
        if (config.environments && config.environments.length > 0) {
          // Check for production environment
          const hasProd = config.environments.some(env => 
            env.type === 'production'
          );
          
          if (!hasProd) {
            warnings.push({
              field: 'environments',
              message: 'No production environment configured',
              suggestion: 'Add a production environment configuration'
            });
          }
          
          // Check deployment strategy
          if (!config.deploymentStrategy) {
            warnings.push({
              field: 'deploymentStrategy',
              message: 'No deployment strategy specified',
              suggestion: 'Consider blue-green or canary deployments for production'
            });
          }
          
          // Check rollback configuration
          if (!config.rollbackEnabled) {
            warnings.push({
              field: 'rollbackEnabled',
              message: 'Rollback not enabled',
              suggestion: 'Enable rollback for safer deployments'
            });
          }
          
          // Validate environment URLs
          for (const env of config.environments) {
            if (!env.url) {
              warnings.push({
                field: `environments.${env.name}.url`,
                message: `URL not specified for ${env.name} environment`
              });
            }
            
            if (env.type === 'production' && !env.approvalRequired) {
              warnings.push({
                field: `environments.${env.name}.approvalRequired`,
                message: 'Production deployment without approval',
                suggestion: 'Enable approval for production deployments'
              });
            }
            
            if (!env.healthChecks || env.healthChecks.length === 0) {
              suggestions.push(`Add health checks for ${env.name} environment`);
            }
          }
        }
        
        return { errors, warnings, suggestions };
      }
    });
    
    // Quality gates validation
    this.addRule({
      name: 'quality-gates',
      description: 'Validates quality gate configuration',
      validate: (config) => {
        const warnings: ValidationWarning[] = [];
        const suggestions: string[] = [];
        
        if (!config.qualityGates) {
          warnings.push({
            field: 'qualityGates',
            message: 'No quality gates configured',
            suggestion: 'Add quality gates to ensure code quality'
          });
        } else {
          if (!config.qualityGates.codeCoverage) {
            suggestions.push('Add code coverage quality gate');
          }
          
          if (!config.qualityGates.security) {
            suggestions.push('Add security quality gate');
          }
          
          if (config.qualityGates.complexity && config.qualityGates.complexity > 15) {
            warnings.push({
              field: 'qualityGates.complexity',
              message: 'Complexity threshold is high',
              suggestion: 'Consider lowering complexity threshold to improve maintainability'
            });
          }
        }
        
        return { warnings, suggestions };
      }
    });
    
    // Integration validation
    this.addRule({
      name: 'integrations',
      description: 'Validates third-party integrations',
      validate: (config) => {
        const suggestions: string[] = [];
        
        if (config.integrations) {
          if (!config.integrations.sonarqube && !config.integrations.snyk) {
            suggestions.push('Consider adding code quality and security scanning tools');
          }
          
          if (!config.integrations.slack && !config.integrations.teams) {
            suggestions.push('Add notification integration for better team communication');
          }
          
          if (config.projectType === 'service' && 
              !config.integrations.datadog && 
              !config.integrations.newRelic) {
            suggestions.push('Consider adding APM integration for service monitoring');
          }
        } else {
          suggestions.push('Configure integrations for better visibility and monitoring');
        }
        
        return { suggestions };
      }
    });
    
    // Performance validation
    this.addRule({
      name: 'performance',
      description: 'Validates performance optimizations',
      validate: (config) => {
        const warnings: ValidationWarning[] = [];
        const suggestions: string[] = [];
        
        if (!config.caching) {
          warnings.push({
            field: 'caching',
            message: 'Caching is disabled',
            suggestion: 'Enable caching to improve build performance'
          });
        }
        
        if (!config.parallelization && config.testingFrameworks?.length > 2) {
          suggestions.push('Consider enabling parallelization for faster test execution');
        }
        
        if (config.matrixBuilds && !config.parallelization) {
          warnings.push({
            field: 'parallelization',
            message: 'Matrix builds without parallelization',
            suggestion: 'Enable parallelization for matrix builds'
          });
        }
        
        return { warnings, suggestions };
      }
    });
  }
  
  addRule(rule: ValidatorRule): void {
    this.rules.push(rule);
  }
  
  validate(config: CICDTemplateConfig): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    
    for (const rule of this.rules) {
      const result = rule.validate(config);
      
      if (result.errors) {
        errors.push(...result.errors);
      }
      
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
      
      if (result.suggestions) {
        suggestions.push(...result.suggestions);
      }
    }
    
    // Calculate score
    let score = 100;
    score -= errors.filter(e => e.severity === 'critical').length * 20;
    score -= errors.filter(e => e.severity === 'error').length * 10;
    score -= warnings.length * 3;
    
    return {
      valid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      suggestions,
      score: Math.max(0, score)
    };
  }
}

/**
 * YAML Validator
 */
export class YAMLValidator {
  validateSyntax(content: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    try {
      // Basic YAML validation
      // In production, use a proper YAML parser
      if (!content || content.trim().length === 0) {
        errors.push({
          field: 'content',
          message: 'YAML content is empty',
          severity: 'critical'
        });
      }
      
      // Check for common YAML issues
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for tabs (YAML doesn't allow tabs for indentation)
        if (line.includes('\t')) {
          errors.push({
            field: 'indentation',
            message: `Tab character found at line ${i + 1}. Use spaces for indentation`,
            severity: 'error',
            line: i + 1
          });
        }
        
        // Check for trailing whitespace
        if (line.endsWith(' ')) {
          errors.push({
            field: 'whitespace',
            message: `Trailing whitespace at line ${i + 1}`,
            severity: 'error',
            line: i + 1
          });
        }
      }
      
    } catch (error) {
      errors.push({
        field: 'syntax',
        message: `YAML parsing error: ${error.message}`,
        severity: 'critical'
      });
    }
    
    return { errors };
  }
  
  validateStructure(content: string, platform: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Platform-specific structure validation
    switch (platform) {
      case 'github-actions':
        if (!content.includes('name:')) {
          warnings.push({
            field: 'name',
            message: 'Workflow name is missing',
            suggestion: 'Add a descriptive name for the workflow'
          });
        }
        
        if (!content.includes('on:')) {
          errors.push({
            field: 'on',
            message: 'Workflow triggers are missing',
            severity: 'critical'
          });
        }
        
        if (!content.includes('jobs:')) {
          errors.push({
            field: 'jobs',
            message: 'No jobs defined in workflow',
            severity: 'critical'
          });
        }
        break;
        
      case 'gitlab-ci':
        if (!content.includes('stages:')) {
          warnings.push({
            field: 'stages',
            message: 'No stages defined',
            suggestion: 'Define stages for better pipeline organization'
          });
        }
        break;
        
      case 'jenkins':
        if (!content.includes('pipeline')) {
          errors.push({
            field: 'pipeline',
            message: 'Pipeline block is missing',
            severity: 'critical'
          });
        }
        
        if (!content.includes('agent')) {
          errors.push({
            field: 'agent',
            message: 'Agent configuration is missing',
            severity: 'error'
          });
        }
        break;
    }
    
    return { errors, warnings };
  }
}

/**
 * Security Validator
 */
export class SecurityValidator {
  validateSecrets(content: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for hardcoded secrets
    const secretPatterns = [
      /password\s*[:=]\s*["'][^"']+["']/gi,
      /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
      /token\s*[:=]\s*["'][^"']+["']/gi,
      /secret\s*[:=]\s*["'][^"']+["']/gi,
      /aws[_-]?access[_-]?key[_-]?id\s*[:=]\s*["'][^"']+["']/gi,
      /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["'][^"']+["']/gi
    ];
    
    for (const pattern of secretPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        errors.push({
          field: 'secrets',
          message: `Potential hardcoded secret found: ${matches[0]}`,
          severity: 'critical'
        });
      }
    }
    
    // Check for proper secret usage
    if (content.includes('${{ secrets.') || content.includes('${secrets.')) {
      // Good - using secret references
    } else if (content.includes('password') || content.includes('token')) {
      warnings.push({
        field: 'secrets',
        message: 'Ensure secrets are properly referenced from secure storage',
        suggestion: 'Use platform-specific secret management'
      });
    }
    
    return { errors, warnings };
  }
  
  validatePermissions(content: string, platform: string): ValidationResult {
    const warnings: ValidationWarning[] = [];
    
    if (platform === 'github-actions') {
      if (!content.includes('permissions:')) {
        warnings.push({
          field: 'permissions',
          message: 'No explicit permissions defined',
          suggestion: 'Define minimal required permissions for security'
        });
      }
      
      if (content.includes('permissions: write-all')) {
        warnings.push({
          field: 'permissions',
          message: 'Using write-all permissions',
          suggestion: 'Use least-privilege principle, specify only needed permissions'
        });
      }
    }
    
    return { warnings };
  }
}

/**
 * Best Practices Validator
 */
export class BestPracticesValidator {
  validate(config: CICDTemplateConfig): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    
    // Artifact management
    if (!config.artifactManagement) {
      suggestions.push('Consider enabling artifact management for build outputs');
    }
    
    // Conditional deployment
    if (!config.conditionalDeployment) {
      suggestions.push('Add conditional deployment based on branch or tags');
    }
    
    // Environment-specific configurations
    if (config.environments && config.environments.length > 1) {
      const hasDevEnv = config.environments.some(e => e.type === 'development');
      const hasStagingEnv = config.environments.some(e => e.type === 'staging');
      
      if (!hasDevEnv) {
        suggestions.push('Add a development environment for testing');
      }
      
      if (!hasStagingEnv) {
        suggestions.push('Add a staging environment for pre-production validation');
      }
    }
    
    // Monitoring and observability
    if (!config.integrations || 
        (!config.integrations.datadog && 
         !config.integrations.newRelic && 
         !config.integrations.sentry)) {
      suggestions.push('Add monitoring and error tracking integrations');
    }
    
    // Documentation
    suggestions.push('Ensure CI/CD pipeline is well-documented');
    suggestions.push('Add troubleshooting guide for common issues');
    
    return { warnings, suggestions };
  }
}

/**
 * Composite Validator
 */
export class TemplateValidator {
  private configValidator = new ConfigurationValidator();
  private yamlValidator = new YAMLValidator();
  private securityValidator = new SecurityValidator();
  private bestPracticesValidator = new BestPracticesValidator();
  
  validateConfig(config: CICDTemplateConfig): ValidationReport {
    return this.configValidator.validate(config);
  }
  
  validateTemplate(content: string, platform: string): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    
    // YAML syntax validation
    const syntaxResult = this.yamlValidator.validateSyntax(content);
    if (syntaxResult.errors) errors.push(...syntaxResult.errors);
    
    // YAML structure validation
    const structureResult = this.yamlValidator.validateStructure(content, platform);
    if (structureResult.errors) errors.push(...structureResult.errors);
    if (structureResult.warnings) warnings.push(...structureResult.warnings);
    
    // Security validation
    const secretsResult = this.securityValidator.validateSecrets(content);
    if (secretsResult.errors) errors.push(...secretsResult.errors);
    if (secretsResult.warnings) warnings.push(...secretsResult.warnings);
    
    const permissionsResult = this.securityValidator.validatePermissions(content, platform);
    if (permissionsResult.warnings) warnings.push(...permissionsResult.warnings);
    
    // Calculate score
    let score = 100;
    score -= errors.filter(e => e.severity === 'critical').length * 20;
    score -= errors.filter(e => e.severity === 'error').length * 10;
    score -= warnings.length * 3;
    
    return {
      valid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      suggestions,
      score: Math.max(0, score)
    };
  }
  
  validateComplete(
    config: CICDTemplateConfig,
    content: string
  ): ValidationReport {
    const configReport = this.validateConfig(config);
    const templateReport = this.validateTemplate(content, config.platform);
    const bestPracticesResult = this.bestPracticesValidator.validate(config);
    
    // Combine results
    const errors = [
      ...configReport.errors,
      ...templateReport.errors
    ];
    
    const warnings = [
      ...configReport.warnings,
      ...templateReport.warnings,
      ...(bestPracticesResult.warnings || [])
    ];
    
    const suggestions = [
      ...configReport.suggestions,
      ...templateReport.suggestions,
      ...(bestPracticesResult.suggestions || [])
    ];
    
    // Calculate combined score
    const score = Math.min(configReport.score, templateReport.score);
    
    return {
      valid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      suggestions,
      score
    };
  }
}