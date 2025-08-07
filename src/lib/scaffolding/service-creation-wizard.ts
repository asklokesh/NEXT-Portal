/**
 * Service Creation Wizard
 * 
 * Interactive multi-step workflow for creating services with technology
 * stack detection, dependency analysis, and best practices guidance.
 */

import { z } from 'zod';
import { AdvancedTemplateEngine, Template, TemplateContext } from './template-engine';
import { TechnologyDetector } from './technology-detector';
import { DependencyAnalyzer } from './dependency-analyzer';
import { IntegrationRequirementDetector } from './integration-detector';
import { BestPracticesEnforcer } from './best-practices';

// Wizard step schemas
const ServiceBasicsSchema = z.object({
  name: z.string().min(1, 'Service name is required')
    .regex(/^[a-z0-9-]+$/, 'Service name must contain only lowercase letters, numbers, and hyphens'),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().min(1, 'Description is required'),
  owner: z.string().min(1, 'Owner is required'),
  team: z.string().min(1, 'Team is required'),
  domain: z.string().optional(),
  system: z.string().optional()
});

const TechnologyStackSchema = z.object({
  primaryLanguage: z.string(),
  framework: z.string().optional(),
  database: z.string().optional(),
  caching: z.string().optional(),
  messaging: z.string().optional(),
  monitoring: z.string().optional(),
  deployment: z.string().optional(),
  customTechnologies: z.array(z.string()).default([])
});

const ArchitecturePatternSchema = z.object({
  pattern: z.enum(['monolith', 'microservice', 'serverless', 'event-driven', 'cqrs', 'hexagonal']),
  apiStyle: z.enum(['rest', 'graphql', 'grpc', 'event-streaming']).optional(),
  dataPattern: z.enum(['single-database', 'database-per-service', 'shared-database', 'event-sourcing']).optional(),
  communicationPattern: z.enum(['synchronous', 'asynchronous', 'hybrid']).optional()
});

const IntegrationRequirementsSchema = z.object({
  externalApis: z.array(z.object({
    name: z.string(),
    type: z.string(),
    authentication: z.string().optional()
  })).default([]),
  internalServices: z.array(z.string()).default([]),
  databases: z.array(z.object({
    name: z.string(),
    type: z.string(),
    purpose: z.string()
  })).default([]),
  messageQueues: z.array(z.string()).default([]),
  fileStorage: z.array(z.string()).default([]),
  monitoring: z.object({
    metrics: z.boolean().default(true),
    logging: z.boolean().default(true),
    tracing: z.boolean().default(false),
    alerting: z.boolean().default(true)
  }).default({}),
  security: z.object({
    authentication: z.string().optional(),
    authorization: z.string().optional(),
    encryption: z.boolean().default(false),
    rateLimiting: z.boolean().default(false)
  }).default({})
});

const DeploymentConfigurationSchema = z.object({
  environment: z.array(z.string()).default(['development', 'staging', 'production']),
  containerization: z.boolean().default(true),
  orchestration: z.enum(['kubernetes', 'docker-swarm', 'none']).default('kubernetes'),
  cicdProvider: z.enum(['github-actions', 'gitlab-ci', 'jenkins', 'azure-devops', 'circleci']),
  deploymentStrategy: z.enum(['blue-green', 'rolling', 'canary', 'recreation']).default('rolling'),
  scaling: z.object({
    horizontal: z.boolean().default(true),
    vertical: z.boolean().default(false),
    autoScaling: z.boolean().default(true)
  }).default({})
});

export type ServiceBasics = z.infer<typeof ServiceBasicsSchema>;
export type TechnologyStack = z.infer<typeof TechnologyStackSchema>;
export type ArchitecturePattern = z.infer<typeof ArchitecturePatternSchema>;
export type IntegrationRequirements = z.infer<typeof IntegrationRequirementsSchema>;
export type DeploymentConfiguration = z.infer<typeof DeploymentConfigurationSchema>;

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  schema: z.ZodSchema;
  optional?: boolean;
  condition?: (data: WizardData) => boolean;
  recommendations?: (data: Partial<WizardData>) => Promise<any>;
  validation?: (data: any) => Promise<string[]>;
}

export interface WizardData {
  serviceBasics?: ServiceBasics;
  technologyStack?: TechnologyStack;
  architecturePattern?: ArchitecturePattern;
  integrationRequirements?: IntegrationRequirements;
  deploymentConfiguration?: DeploymentConfiguration;
  customParameters?: Record<string, any>;
}

export interface WizardRecommendation {
  type: 'technology' | 'pattern' | 'integration' | 'best-practice' | 'security';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  suggestion: string;
  autoApply?: boolean;
  impact: {
    complexity: 'low' | 'medium' | 'high';
    maintenance: 'low' | 'medium' | 'high';
    performance: 'positive' | 'neutral' | 'negative';
  };
}

export interface WizardResult {
  success: boolean;
  serviceData: WizardData;
  recommendedTemplates: Template[];
  selectedTemplate?: Template;
  recommendations: WizardRecommendation[];
  estimatedComplexity: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  dependencies: Array<{
    name: string;
    version: string;
    purpose: string;
    optional: boolean;
  }>;
  nextSteps: string[];
}

export class ServiceCreationWizard {
  private steps: WizardStep[] = [];
  private technologyDetector: TechnologyDetector;
  private dependencyAnalyzer: DependencyAnalyzer;
  private integrationDetector: IntegrationRequirementDetector;
  private bestPracticesEnforcer: BestPracticesEnforcer;

  constructor(
    private templateEngine: AdvancedTemplateEngine,
    private organizationConfig: {
      name: string;
      domain: string;
      defaults: Record<string, any>;
      policies: Record<string, any>;
    }
  ) {
    this.technologyDetector = new TechnologyDetector();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.integrationDetector = new IntegrationRequirementDetector();
    this.bestPracticesEnforcer = new BestPracticesEnforcer(organizationConfig.policies);
    
    this.initializeSteps();
  }

  /**
   * Initialize wizard steps
   */
  private initializeSteps(): void {
    this.steps = [
      {
        id: 'service-basics',
        title: 'Service Basics',
        description: 'Define the fundamental properties of your service',
        schema: ServiceBasicsSchema,
        validation: this.validateServiceBasics.bind(this)
      },
      {
        id: 'technology-stack',
        title: 'Technology Stack',
        description: 'Choose the technologies for your service',
        schema: TechnologyStackSchema,
        recommendations: this.getTechnologyRecommendations.bind(this)
      },
      {
        id: 'architecture-pattern',
        title: 'Architecture Pattern',
        description: 'Select architectural patterns and design principles',
        schema: ArchitecturePatternSchema,
        recommendations: this.getArchitectureRecommendations.bind(this)
      },
      {
        id: 'integration-requirements',
        title: 'Integration Requirements',
        description: 'Define how your service will integrate with other systems',
        schema: IntegrationRequirementsSchema,
        optional: true,
        recommendations: this.getIntegrationRecommendations.bind(this)
      },
      {
        id: 'deployment-configuration',
        title: 'Deployment Configuration',
        description: 'Configure deployment and infrastructure settings',
        schema: DeploymentConfigurationSchema,
        recommendations: this.getDeploymentRecommendations.bind(this)
      }
    ];
  }

  /**
   * Get wizard steps with dynamic filtering
   */
  getSteps(currentData?: Partial<WizardData>): WizardStep[] {
    return this.steps.filter(step => {
      if (!step.condition) return true;
      return step.condition(currentData as WizardData);
    });
  }

  /**
   * Validate step data
   */
  async validateStep(stepId: string, data: any): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Unknown step: ${stepId}`);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema validation
    try {
      step.schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push(error.message);
      }
    }

    // Custom validation
    if (step.validation) {
      const customErrors = await step.validation(data);
      errors.push(...customErrors);
    }

    // Best practices validation
    const practiceViolations = await this.bestPracticesEnforcer.validate(stepId, data);
    warnings.push(...practiceViolations.filter(v => v.severity === 'warning').map(v => v.message));
    errors.push(...practiceViolations.filter(v => v.severity === 'error').map(v => v.message));

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get recommendations for a step
   */
  async getRecommendations(stepId: string, currentData: Partial<WizardData>): Promise<WizardRecommendation[]> {
    const step = this.steps.find(s => s.id === stepId);
    if (!step || !step.recommendations) {
      return [];
    }

    try {
      const stepRecommendations = await step.recommendations(currentData);
      return Array.isArray(stepRecommendations) ? stepRecommendations : [];
    } catch (error) {
      console.warn(`Failed to get recommendations for step ${stepId}:`, error);
      return [];
    }
  }

  /**
   * Complete the wizard and generate service
   */
  async completeWizard(data: WizardData): Promise<WizardResult> {
    try {
      // Final validation
      await this.validateCompleteData(data);

      // Get template recommendations
      const recommendedTemplates = await this.getTemplateRecommendations(data);
      
      // Select best template
      const selectedTemplate = this.selectBestTemplate(recommendedTemplates, data);

      // Get all recommendations
      const allRecommendations = await this.getAllRecommendations(data);

      // Calculate complexity and time estimates
      const estimatedComplexity = this.calculateComplexity(data);
      const estimatedTime = this.calculateEstimatedTime(data, estimatedComplexity);

      // Analyze dependencies
      const dependencies = await this.dependencyAnalyzer.analyzeDependencies(data);

      // Generate next steps
      const nextSteps = this.generateNextSteps(data, selectedTemplate);

      return {
        success: true,
        serviceData: data,
        recommendedTemplates,
        selectedTemplate,
        recommendations: allRecommendations,
        estimatedComplexity,
        estimatedTime,
        dependencies,
        nextSteps
      };

    } catch (error) {
      return {
        success: false,
        serviceData: data,
        recommendedTemplates: [],
        recommendations: [],
        estimatedComplexity: 'beginner',
        estimatedTime: 'Unknown',
        dependencies: [],
        nextSteps: []
      };
    }
  }

  /**
   * Generate service from wizard result
   */
  async generateService(wizardResult: WizardResult, context: TemplateContext): Promise<any> {
    if (!wizardResult.selectedTemplate) {
      throw new Error('No template selected for service generation');
    }

    // Merge wizard data with template context
    const enhancedContext: TemplateContext = {
      ...context,
      parameters: {
        ...context.parameters,
        ...this.convertWizardDataToParameters(wizardResult.serviceData)
      }
    };

    // Execute template
    return await this.templateEngine.executeTemplate(
      wizardResult.selectedTemplate,
      enhancedContext
    );
  }

  /**
   * Validate service basics
   */
  private async validateServiceBasics(data: ServiceBasics): Promise<string[]> {
    const errors: string[] = [];

    // Check if service name already exists
    // This would integrate with your service catalog
    const existingServices = []; // Fetch from catalog
    if (existingServices.includes(data.name)) {
      errors.push('Service name already exists');
    }

    // Validate naming conventions
    if (!this.organizationConfig.policies.namingConvention) {
      // Apply organization-specific naming rules
    }

    return errors;
  }

  /**
   * Get technology recommendations
   */
  private async getTechnologyRecommendations(data: Partial<WizardData>): Promise<WizardRecommendation[]> {
    if (!data.serviceBasics) return [];

    return await this.technologyDetector.getRecommendations({
      serviceType: data.serviceBasics.domain || 'general',
      teamPreferences: data.serviceBasics.team,
      organizationStandards: this.organizationConfig.defaults.technologies
    });
  }

  /**
   * Get architecture recommendations
   */
  private async getArchitectureRecommendations(data: Partial<WizardData>): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    if (data.serviceBasics && data.technologyStack) {
      // Analyze based on service characteristics
      const characteristics = {
        expectedLoad: 'medium', // Could be determined from questions
        dataComplexity: 'medium',
        teamSize: 'small',
        timeToMarket: 'fast'
      };

      recommendations.push(...await this.getPatternRecommendations(characteristics));
    }

    return recommendations;
  }

  /**
   * Get integration recommendations
   */
  private async getIntegrationRecommendations(data: Partial<WizardData>): Promise<WizardRecommendation[]> {
    if (!data.serviceBasics) return [];

    return await this.integrationDetector.analyzeRequirements({
      serviceName: data.serviceBasics.name,
      domain: data.serviceBasics.domain,
      team: data.serviceBasics.team,
      existingServices: [] // Fetch from catalog
    });
  }

  /**
   * Get deployment recommendations
   */
  private async getDeploymentRecommendations(data: Partial<WizardData>): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    if (data.technologyStack && data.architecturePattern) {
      // Recommend based on technology and architecture
      recommendations.push({
        type: 'best-practice',
        title: 'Container Deployment',
        description: 'Use containerization for consistent deployments',
        severity: 'info',
        suggestion: 'Enable Docker containerization for your service',
        autoApply: true,
        impact: {
          complexity: 'low',
          maintenance: 'low',
          performance: 'positive'
        }
      });
    }

    return recommendations;
  }

  /**
   * Get pattern recommendations based on characteristics
   */
  private async getPatternRecommendations(characteristics: any): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Example logic for pattern recommendations
    if (characteristics.teamSize === 'small' && characteristics.timeToMarket === 'fast') {
      recommendations.push({
        type: 'pattern',
        title: 'Monolithic Architecture',
        description: 'Start with a monolith for faster development and simpler deployment',
        severity: 'info',
        suggestion: 'Use monolithic pattern for initial development',
        impact: {
          complexity: 'low',
          maintenance: 'medium',
          performance: 'neutral'
        }
      });
    }

    return recommendations;
  }

  /**
   * Validate complete wizard data
   */
  private async validateCompleteData(data: WizardData): Promise<void> {
    for (const step of this.steps) {
      if (!step.optional && !data[step.id as keyof WizardData]) {
        throw new Error(`Required step ${step.id} is missing`);
      }
    }
  }

  /**
   * Get template recommendations based on wizard data
   */
  private async getTemplateRecommendations(data: WizardData): Promise<Template[]> {
    const filters = {
      technology: data.technologyStack ? [data.technologyStack.primaryLanguage] : undefined,
      category: this.mapDomainToCategory(data.serviceBasics?.domain),
      complexity: this.calculateComplexity(data)
    };

    return await this.templateEngine.getAvailableTemplates(filters);
  }

  /**
   * Select the best template from recommendations
   */
  private selectBestTemplate(templates: Template[], data: WizardData): Template | undefined {
    if (templates.length === 0) return undefined;

    // Score templates based on match with wizard data
    const scoredTemplates = templates.map(template => ({
      template,
      score: this.calculateTemplateScore(template, data)
    }));

    scoredTemplates.sort((a, b) => b.score - a.score);
    return scoredTemplates[0]?.template;
  }

  /**
   * Calculate template score based on wizard data
   */
  private calculateTemplateScore(template: Template, data: WizardData): number {
    let score = 0;

    // Technology match
    if (data.technologyStack?.primaryLanguage && 
        template.metadata.technology.includes(data.technologyStack.primaryLanguage)) {
      score += 10;
    }

    // Category match
    const category = this.mapDomainToCategory(data.serviceBasics?.domain);
    if (category && template.metadata.category === category) {
      score += 5;
    }

    // Complexity match
    const complexity = this.calculateComplexity(data);
    if (template.metadata.complexity === complexity) {
      score += 5;
    }

    return score;
  }

  /**
   * Get all recommendations from all steps
   */
  private async getAllRecommendations(data: WizardData): Promise<WizardRecommendation[]> {
    const allRecommendations: WizardRecommendation[] = [];

    for (const step of this.steps) {
      const stepRecommendations = await this.getRecommendations(step.id, data);
      allRecommendations.push(...stepRecommendations);
    }

    // Add cross-cutting recommendations
    allRecommendations.push(...await this.getCrossCuttingRecommendations(data));

    return allRecommendations;
  }

  /**
   * Get cross-cutting recommendations
   */
  private async getCrossCuttingRecommendations(data: WizardData): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Security recommendations
    if (!data.integrationRequirements?.security?.authentication) {
      recommendations.push({
        type: 'security',
        title: 'Authentication Required',
        description: 'Your service should implement authentication',
        severity: 'warning',
        suggestion: 'Add authentication to your service configuration',
        impact: {
          complexity: 'medium',
          maintenance: 'medium',
          performance: 'neutral'
        }
      });
    }

    // Monitoring recommendations
    if (!data.integrationRequirements?.monitoring?.metrics) {
      recommendations.push({
        type: 'best-practice',
        title: 'Add Monitoring',
        description: 'Enable metrics collection for observability',
        severity: 'info',
        suggestion: 'Enable metrics, logging, and alerting',
        autoApply: true,
        impact: {
          complexity: 'low',
          maintenance: 'low',
          performance: 'positive'
        }
      });
    }

    return recommendations;
  }

  /**
   * Calculate service complexity
   */
  private calculateComplexity(data: WizardData): 'beginner' | 'intermediate' | 'advanced' {
    let complexityScore = 0;

    // Base complexity from architecture
    if (data.architecturePattern?.pattern === 'microservice') complexityScore += 2;
    if (data.architecturePattern?.pattern === 'event-driven') complexityScore += 3;
    if (data.architecturePattern?.pattern === 'cqrs') complexityScore += 4;

    // Integration complexity
    const integrations = data.integrationRequirements;
    if (integrations) {
      complexityScore += integrations.externalApis.length;
      complexityScore += integrations.internalServices.length;
      complexityScore += integrations.databases.length;
    }

    // Technology complexity
    if (data.technologyStack?.messaging) complexityScore += 1;
    if (data.technologyStack?.caching) complexityScore += 1;

    if (complexityScore <= 2) return 'beginner';
    if (complexityScore <= 6) return 'intermediate';
    return 'advanced';
  }

  /**
   * Calculate estimated time
   */
  private calculateEstimatedTime(data: WizardData, complexity: string): string {
    const baseHours = {
      'beginner': 8,
      'intermediate': 24,
      'advanced': 72
    };

    let hours = baseHours[complexity];

    // Adjust based on integrations
    const integrations = data.integrationRequirements;
    if (integrations) {
      hours += integrations.externalApis.length * 4;
      hours += integrations.internalServices.length * 2;
      hours += integrations.databases.length * 3;
    }

    if (hours <= 8) return '1 day';
    if (hours <= 24) return '1-3 days';
    if (hours <= 72) return '1-2 weeks';
    return '2+ weeks';
  }

  /**
   * Convert wizard data to template parameters
   */
  private convertWizardDataToParameters(data: WizardData): Record<string, any> {
    return {
      // Service basics
      serviceName: data.serviceBasics?.name,
      displayName: data.serviceBasics?.displayName,
      description: data.serviceBasics?.description,
      owner: data.serviceBasics?.owner,
      team: data.serviceBasics?.team,
      domain: data.serviceBasics?.domain,
      system: data.serviceBasics?.system,

      // Technology
      language: data.technologyStack?.primaryLanguage,
      framework: data.technologyStack?.framework,
      database: data.technologyStack?.database,
      
      // Architecture
      architecturePattern: data.architecturePattern?.pattern,
      apiStyle: data.architecturePattern?.apiStyle,
      
      // Integrations
      integrations: data.integrationRequirements,
      
      // Deployment
      deployment: data.deploymentConfiguration,
      
      // Custom parameters
      ...data.customParameters
    };
  }

  /**
   * Map domain to template category
   */
  private mapDomainToCategory(domain?: string): string {
    const domainMapping: Record<string, string> = {
      'user-management': 'service',
      'payment': 'service',
      'notification': 'service',
      'analytics': 'data',
      'reporting': 'data',
      'ui': 'frontend',
      'admin': 'tool'
    };

    return domain ? domainMapping[domain] || 'service' : 'service';
  }

  /**
   * Generate next steps for service development
   */
  private generateNextSteps(data: WizardData, template?: Template): string[] {
    const steps: string[] = [];

    steps.push('Review and execute the selected template');
    steps.push('Set up development environment');
    
    if (data.deploymentConfiguration?.containerization) {
      steps.push('Configure Docker containerization');
    }
    
    if (data.integrationRequirements?.monitoring?.metrics) {
      steps.push('Set up monitoring and observability');
    }
    
    steps.push('Implement initial service functionality');
    steps.push('Set up CI/CD pipeline');
    steps.push('Deploy to development environment');
    steps.push('Register service in catalog');

    return steps;
  }
}