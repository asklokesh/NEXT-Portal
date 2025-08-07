/**
 * Best Practices Enforcer
 * 
 * Enforces organizational best practices and coding standards
 * during service scaffolding process.
 */

export interface BestPracticeViolation {
  severity: 'error' | 'warning' | 'info';
  category: 'naming' | 'security' | 'performance' | 'maintainability' | 'scalability' | 'monitoring';
  message: string;
  suggestion: string;
  rule: string;
  autoFixable: boolean;
}

export interface OrganizationPolicies {
  naming: {
    serviceNamePattern?: RegExp;
    databaseNamingConvention?: 'snake_case' | 'camelCase' | 'kebab-case';
    apiVersioningRequired?: boolean;
    tagRequirements?: string[];
  };
  security: {
    authenticationRequired?: boolean;
    authorizationRequired?: boolean;
    encryptionRequired?: boolean;
    minTlsVersion?: string;
    allowedAuthProviders?: string[];
    secretManagementRequired?: boolean;
  };
  architecture: {
    maxServiceDependencies?: number;
    preferredPatterns?: string[];
    restrictedPatterns?: string[];
    databasePerService?: boolean;
    asyncPreferred?: boolean;
  };
  monitoring: {
    healthCheckRequired?: boolean;
    metricsRequired?: boolean;
    loggingRequired?: boolean;
    distributedTracingRequired?: boolean;
    alertingRequired?: boolean;
  };
  deployment: {
    containerizationRequired?: boolean;
    kubernetesRequired?: boolean;
    cicdRequired?: boolean;
    multiEnvironmentRequired?: boolean;
    canaryDeploymentPreferred?: boolean;
  };
  testing: {
    unitTestCoverageMin?: number;
    integrationTestsRequired?: boolean;
    e2eTestsRequired?: boolean;
    performanceTestsRequired?: boolean;
    securityTestsRequired?: boolean;
  };
  documentation: {
    readmeRequired?: boolean;
    apiDocumentationRequired?: boolean;
    architectureDecisionRecordsRequired?: boolean;
    runbooksRequired?: boolean;
  };
}

export class BestPracticesEnforcer {
  constructor(private policies: OrganizationPolicies) {}

  /**
   * Validate data against best practices
   */
  async validate(stepId: string, data: any): Promise<BestPracticeViolation[]> {
    const violations: BestPracticeViolation[] = [];

    switch (stepId) {
      case 'service-basics':
        violations.push(...await this.validateServiceBasics(data));
        break;
      case 'technology-stack':
        violations.push(...await this.validateTechnologyStack(data));
        break;
      case 'architecture-pattern':
        violations.push(...await this.validateArchitecturePattern(data));
        break;
      case 'integration-requirements':
        violations.push(...await this.validateIntegrationRequirements(data));
        break;
      case 'deployment-configuration':
        violations.push(...await this.validateDeploymentConfiguration(data));
        break;
    }

    return violations;
  }

  /**
   * Get comprehensive best practices report
   */
  async getComprehensiveReport(allData: Record<string, any>): Promise<{
    violations: BestPracticeViolation[];
    recommendations: Array<{
      category: string;
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      effort: 'low' | 'medium' | 'high';
    }>;
    score: {
      overall: number;
      categories: Record<string, number>;
    };
  }> {
    const violations: BestPracticeViolation[] = [];
    
    // Collect all violations
    for (const [stepId, stepData] of Object.entries(allData)) {
      const stepViolations = await this.validate(stepId, stepData);
      violations.push(...stepViolations);
    }

    // Generate recommendations
    const recommendations = await this.generateRecommendations(allData, violations);

    // Calculate scores
    const score = this.calculateBestPracticesScore(violations);

    return {
      violations,
      recommendations,
      score
    };
  }

  /**
   * Auto-fix violations where possible
   */
  async autoFix(data: any, violations: BestPracticeViolation[]): Promise<{
    fixedData: any;
    appliedFixes: string[];
    remainingViolations: BestPracticeViolation[];
  }> {
    const fixedData = JSON.parse(JSON.stringify(data));
    const appliedFixes: string[] = [];
    const remainingViolations: BestPracticeViolation[] = [];

    for (const violation of violations) {
      if (violation.autoFixable) {
        const fixed = await this.applyAutoFix(fixedData, violation);
        if (fixed) {
          appliedFixes.push(violation.message);
        } else {
          remainingViolations.push(violation);
        }
      } else {
        remainingViolations.push(violation);
      }
    }

    return {
      fixedData,
      appliedFixes,
      remainingViolations
    };
  }

  /**
   * Validate service basics
   */
  private async validateServiceBasics(data: any): Promise<BestPracticeViolation[]> {
    const violations: BestPracticeViolation[] = [];

    // Validate service naming
    if (this.policies.naming?.serviceNamePattern) {
      if (!this.policies.naming.serviceNamePattern.test(data.name)) {
        violations.push({
          severity: 'error',
          category: 'naming',
          message: 'Service name does not follow organizational naming convention',
          suggestion: 'Use the required naming pattern for service names',
          rule: 'service-naming-convention',
          autoFixable: false
        });
      }
    }

    // Validate required tags
    if (this.policies.naming?.tagRequirements) {
      const missingTags = this.policies.naming.tagRequirements.filter(
        tag => !data.tags?.includes(tag)
      );
      if (missingTags.length > 0) {
        violations.push({
          severity: 'warning',
          category: 'naming',
          message: `Missing required tags: ${missingTags.join(', ')}`,
          suggestion: 'Add the required organizational tags',
          rule: 'required-tags',
          autoFixable: true
        });
      }
    }

    // Validate owner is specified
    if (!data.owner) {
      violations.push({
        severity: 'error',
        category: 'maintainability',
        message: 'Service owner must be specified',
        suggestion: 'Assign a clear owner for the service',
        rule: 'service-ownership',
        autoFixable: false
      });
    }

    // Validate description quality
    if (data.description && data.description.length < 20) {
      violations.push({
        severity: 'warning',
        category: 'maintainability',
        message: 'Service description is too brief',
        suggestion: 'Provide a more detailed description of the service purpose',
        rule: 'meaningful-description',
        autoFixable: false
      });
    }

    return violations;
  }

  /**
   * Validate technology stack
   */
  private async validateTechnologyStack(data: any): Promise<BestPracticeViolation[]> {
    const violations: BestPracticeViolation[] = [];

    // Check for deprecated technologies
    const deprecatedTechnologies = ['python2', 'node12', 'php7'];
    if (deprecatedTechnologies.includes(data.primaryLanguage?.toLowerCase())) {
      violations.push({
        severity: 'error',
        category: 'maintainability',
        message: `${data.primaryLanguage} is deprecated or unsupported`,
        suggestion: 'Use a supported version of the technology',
        rule: 'no-deprecated-technologies',
        autoFixable: true
      });
    }

    // Recommend specific database patterns
    if (this.policies.architecture?.databasePerService && !data.database) {
      violations.push({
        severity: 'warning',
        category: 'scalability',
        message: 'Database-per-service pattern is recommended',
        suggestion: 'Consider assigning a dedicated database to this service',
        rule: 'database-per-service',
        autoFixable: false
      });
    }

    // Check for monitoring stack
    if (this.policies.monitoring?.metricsRequired && !data.monitoring) {
      violations.push({
        severity: 'warning',
        category: 'monitoring',
        message: 'Monitoring stack is required',
        suggestion: 'Add monitoring and observability tools to your stack',
        rule: 'monitoring-required',
        autoFixable: true
      });
    }

    return violations;
  }

  /**
   * Validate architecture pattern
   */
  private async validateArchitecturePattern(data: any): Promise<BestPracticeViolation[]> {
    const violations: BestPracticeViolation[] = [];

    // Check restricted patterns
    if (this.policies.architecture?.restrictedPatterns?.includes(data.pattern)) {
      violations.push({
        severity: 'error',
        category: 'scalability',
        message: `Architecture pattern '${data.pattern}' is restricted in this organization`,
        suggestion: `Use one of the preferred patterns: ${this.policies.architecture.preferredPatterns?.join(', ')}`,
        rule: 'restricted-patterns',
        autoFixable: false
      });
    }

    // Recommend async communication
    if (this.policies.architecture?.asyncPreferred && data.communicationPattern === 'synchronous') {
      violations.push({
        severity: 'info',
        category: 'scalability',
        message: 'Asynchronous communication is preferred for better scalability',
        suggestion: 'Consider using asynchronous communication patterns where appropriate',
        rule: 'async-preferred',
        autoFixable: false
      });
    }

    // API versioning check
    if (this.policies.naming?.apiVersioningRequired && !data.apiVersioning) {
      violations.push({
        severity: 'warning',
        category: 'maintainability',
        message: 'API versioning is required',
        suggestion: 'Implement API versioning strategy for backward compatibility',
        rule: 'api-versioning-required',
        autoFixable: true
      });
    }

    return violations;
  }

  /**
   * Validate integration requirements
   */
  private async validateIntegrationRequirements(data: any): Promise<BestPracticeViolation[]> {
    const violations: BestPracticeViolation[] = [];

    // Security requirements
    if (this.policies.security?.authenticationRequired && !data.security?.authentication) {
      violations.push({
        severity: 'error',
        category: 'security',
        message: 'Authentication is required for all services',
        suggestion: 'Implement authentication mechanism',
        rule: 'authentication-required',
        autoFixable: true
      });
    }

    if (this.policies.security?.encryptionRequired && !data.security?.encryption) {
      violations.push({
        severity: 'error',
        category: 'security',
        message: 'Encryption is required for data in transit and at rest',
        suggestion: 'Enable encryption for sensitive data',
        rule: 'encryption-required',
        autoFixable: true
      });
    }

    // Check for too many dependencies
    const totalDependencies = (data.externalApis?.length || 0) + 
                             (data.internalServices?.length || 0) + 
                             (data.databases?.length || 0);
    
    if (this.policies.architecture?.maxServiceDependencies && 
        totalDependencies > this.policies.architecture.maxServiceDependencies) {
      violations.push({
        severity: 'warning',
        category: 'scalability',
        message: `Service has too many dependencies (${totalDependencies})`,
        suggestion: 'Consider reducing dependencies to improve maintainability',
        rule: 'max-dependencies',
        autoFixable: false
      });
    }

    // Monitoring requirements
    if (this.policies.monitoring?.healthCheckRequired && !data.monitoring?.healthCheck) {
      violations.push({
        severity: 'warning',
        category: 'monitoring',
        message: 'Health check endpoint is required',
        suggestion: 'Implement health check endpoint for service monitoring',
        rule: 'health-check-required',
        autoFixable: true
      });
    }

    return violations;
  }

  /**
   * Validate deployment configuration
   */
  private async validateDeploymentConfiguration(data: any): Promise<BestPracticeViolation[]> {
    const violations: BestPracticeViolation[] = [];

    // Containerization requirement
    if (this.policies.deployment?.containerizationRequired && !data.containerization) {
      violations.push({
        severity: 'error',
        category: 'scalability',
        message: 'Containerization is required for all services',
        suggestion: 'Enable Docker containerization',
        rule: 'containerization-required',
        autoFixable: true
      });
    }

    // CI/CD requirement
    if (this.policies.deployment?.cicdRequired && !data.cicdProvider) {
      violations.push({
        severity: 'warning',
        category: 'maintainability',
        message: 'CI/CD pipeline is required',
        suggestion: 'Set up continuous integration and deployment',
        rule: 'cicd-required',
        autoFixable: true
      });
    }

    // Multi-environment deployment
    if (this.policies.deployment?.multiEnvironmentRequired && 
        (!data.environment || data.environment.length < 2)) {
      violations.push({
        severity: 'warning',
        category: 'maintainability',
        message: 'Multi-environment deployment is required',
        suggestion: 'Configure deployment to multiple environments (dev, staging, prod)',
        rule: 'multi-environment-required',
        autoFixable: true
      });
    }

    // Canary deployment preference
    if (this.policies.deployment?.canaryDeploymentPreferred && 
        data.deploymentStrategy !== 'canary') {
      violations.push({
        severity: 'info',
        category: 'scalability',
        message: 'Canary deployment is preferred for production services',
        suggestion: 'Consider using canary deployment strategy for safer releases',
        rule: 'canary-deployment-preferred',
        autoFixable: true
      });
    }

    return violations;
  }

  /**
   * Generate recommendations based on violations and data
   */
  private async generateRecommendations(allData: Record<string, any>, violations: BestPracticeViolation[]): Promise<any[]> {
    const recommendations: any[] = [];

    // Group violations by category
    const violationsByCategory = violations.reduce((acc, violation) => {
      if (!acc[violation.category]) acc[violation.category] = [];
      acc[violation.category].push(violation);
      return acc;
    }, {} as Record<string, BestPracticeViolation[]>);

    // Generate category-specific recommendations
    for (const [category, categoryViolations] of Object.entries(violationsByCategory)) {
      const errorCount = categoryViolations.filter(v => v.severity === 'error').length;
      const warningCount = categoryViolations.filter(v => v.severity === 'warning').length;

      if (errorCount > 0 || warningCount > 2) {
        recommendations.push({
          category,
          title: `Address ${category} issues`,
          description: `Found ${errorCount} errors and ${warningCount} warnings in ${category}`,
          priority: errorCount > 0 ? 'high' : 'medium',
          effort: categoryViolations.length > 5 ? 'high' : 'medium'
        });
      }
    }

    // Specific recommendations based on data patterns
    if (allData.technologyStack && !allData.integrationRequirements?.monitoring) {
      recommendations.push({
        category: 'monitoring',
        title: 'Add comprehensive monitoring',
        description: 'Set up metrics, logging, and alerting for your service',
        priority: 'medium',
        effort: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Calculate best practices score
   */
  private calculateBestPracticesScore(violations: BestPracticeViolation[]): any {
    const totalPoints = 100;
    let deductions = 0;

    for (const violation of violations) {
      switch (violation.severity) {
        case 'error':
          deductions += 10;
          break;
        case 'warning':
          deductions += 5;
          break;
        case 'info':
          deductions += 1;
          break;
      }
    }

    const overall = Math.max(0, totalPoints - deductions);

    // Calculate category scores
    const categories = ['naming', 'security', 'performance', 'maintainability', 'scalability', 'monitoring'];
    const categoryScores: Record<string, number> = {};

    for (const category of categories) {
      const categoryViolations = violations.filter(v => v.category === category);
      let categoryDeductions = 0;
      
      for (const violation of categoryViolations) {
        switch (violation.severity) {
          case 'error':
            categoryDeductions += 15;
            break;
          case 'warning':
            categoryDeductions += 8;
            break;
          case 'info':
            categoryDeductions += 2;
            break;
        }
      }
      
      categoryScores[category] = Math.max(0, 100 - categoryDeductions);
    }

    return {
      overall,
      categories: categoryScores
    };
  }

  /**
   * Apply auto-fix for a violation
   */
  private async applyAutoFix(data: any, violation: BestPracticeViolation): Promise<boolean> {
    try {
      switch (violation.rule) {
        case 'required-tags':
          if (!data.tags) data.tags = [];
          // Add missing required tags
          if (this.policies.naming?.tagRequirements) {
            for (const tag of this.policies.naming.tagRequirements) {
              if (!data.tags.includes(tag)) {
                data.tags.push(tag);
              }
            }
          }
          return true;

        case 'monitoring-required':
          if (!data.monitoring) {
            data.monitoring = {
              metrics: true,
              logging: true,
              healthCheck: true
            };
          }
          return true;

        case 'health-check-required':
          if (!data.monitoring) data.monitoring = {};
          data.monitoring.healthCheck = true;
          return true;

        case 'authentication-required':
          if (!data.security) data.security = {};
          data.security.authentication = 'oauth2';
          return true;

        case 'encryption-required':
          if (!data.security) data.security = {};
          data.security.encryption = true;
          return true;

        case 'containerization-required':
          data.containerization = true;
          return true;

        case 'cicd-required':
          if (!data.cicdProvider) {
            data.cicdProvider = 'github-actions';
          }
          return true;

        case 'api-versioning-required':
          data.apiVersioning = true;
          return true;

        case 'canary-deployment-preferred':
          data.deploymentStrategy = 'canary';
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.warn(`Failed to apply auto-fix for ${violation.rule}:`, error);
      return false;
    }
  }
}