/**
 * AI-Powered Entity Templates with Dynamic Generation
 * Intelligent template system that creates context-aware entity templates
 * Making Backstage's static YAML templates look primitive
 */

import { GraphEntity, EntityType } from './graph-model';

// Template Configuration
export interface TemplateConfig {
  enabledGenerators: GeneratorType[];
  aiModels: AIModelConfig[];
  customTemplates: CustomTemplate[];
  validationRules: ValidationRule[];
  defaultParameters: DefaultParameters;
  learningEnabled: boolean;
  templateVersioning: boolean;
}

export enum GeneratorType {
  CONTEXT_AWARE = 'CONTEXT_AWARE',
  PATTERN_BASED = 'PATTERN_BASED',
  TECHNOLOGY_SPECIFIC = 'TECHNOLOGY_SPECIFIC',
  INDUSTRY_SPECIFIC = 'INDUSTRY_SPECIFIC',
  COMPLIANCE_DRIVEN = 'COMPLIANCE_DRIVEN',
  BEST_PRACTICE = 'BEST_PRACTICE'
}

export interface AIModelConfig {
  name: string;
  type: 'GPT' | 'CLAUDE' | 'BERT' | 'CUSTOM';
  endpoint?: string;
  apiKey?: string;
  parameters: Record<string, any>;
  capabilities: ModelCapability[];
}

export enum ModelCapability {
  TEXT_GENERATION = 'TEXT_GENERATION',
  CODE_ANALYSIS = 'CODE_ANALYSIS',
  PATTERN_RECOGNITION = 'PATTERN_RECOGNITION',
  COMPLIANCE_MAPPING = 'COMPLIANCE_MAPPING',
  TECH_STACK_DETECTION = 'TECH_STACK_DETECTION'
}

// Template Types
export interface EntityTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: TemplateCategory;
  
  // Template Definition
  entityType: EntityType;
  schema: TemplateSchema;
  parameters: TemplateParameter[];
  
  // AI Generation Context
  generationContext: GenerationContext;
  
  // Metadata
  metadata: TemplateMetadata;
  
  // Validation
  validationRules: ValidationRule[];
  
  // Usage Statistics
  usage: TemplateUsage;
}

export enum TemplateCategory {
  MICROSERVICE = 'MICROSERVICE',
  API = 'API',
  DATABASE = 'DATABASE',
  FRONTEND = 'FRONTEND',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  DATA_PIPELINE = 'DATA_PIPELINE',
  ML_MODEL = 'ML_MODEL',
  SECURITY = 'SECURITY',
  MONITORING = 'MONITORING',
  GENERIC = 'GENERIC'
}

export interface TemplateSchema {
  required: string[];
  properties: Record<string, PropertyDefinition>;
  conditionalProperties?: ConditionalProperty[];
  dynamicProperties?: DynamicProperty[];
}

export interface PropertyDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  description: string;
  default?: any;
  enum?: string[];
  pattern?: string;
  validation?: string; // regex or function
  aiGenerated?: boolean;
  dependencies?: string[]; // other properties this depends on
}

export interface ConditionalProperty {
  condition: string; // JavaScript expression
  properties: Record<string, PropertyDefinition>;
}

export interface DynamicProperty {
  name: string;
  generator: string; // function name or AI prompt
  dependencies: string[];
  cacheKey?: string;
}

export interface TemplateParameter {
  name: string;
  type: 'input' | 'select' | 'multiselect' | 'boolean' | 'file' | 'code' | 'json';
  label: string;
  description: string;
  required: boolean;
  default?: any;
  options?: ParameterOption[];
  validation?: ParameterValidation;
  aiAssisted?: boolean;
  placeholder?: string;
}

export interface ParameterOption {
  value: any;
  label: string;
  description?: string;
  icon?: string;
}

export interface ParameterValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: string; // function name
}

export interface GenerationContext {
  industry?: string;
  techStack: string[];
  complianceFrameworks: string[];
  organizationSize: 'STARTUP' | 'SME' | 'ENTERPRISE';
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deploymentModel: 'CLOUD' | 'ON_PREMISE' | 'HYBRID';
  developmentStage: 'PROTOTYPE' | 'MVP' | 'PRODUCTION' | 'MATURE';
  constraints: GenerationConstraint[];
}

export interface GenerationConstraint {
  type: 'COMPLIANCE' | 'SECURITY' | 'PERFORMANCE' | 'BUDGET' | 'TIMELINE';
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TemplateMetadata {
  createdBy: 'AI' | 'USER' | 'SYSTEM';
  createdAt: Date;
  lastModified: Date;
  version: string;
  tags: string[];
  popularity: number; // usage count
  rating: number; // 1-5 stars
  aiConfidence?: number; // 0-100 for AI-generated templates
  sourceTemplates?: string[]; // templates this was derived from
  improvements?: TemplateImprovement[];
}

export interface TemplateImprovement {
  version: string;
  improvementType: 'AI_OPTIMIZATION' | 'USER_FEEDBACK' | 'COMPLIANCE_UPDATE' | 'BEST_PRACTICE';
  description: string;
  appliedAt: Date;
  impact: string;
}

export interface TemplateUsage {
  totalUses: number;
  successRate: number; // successful entity creations
  averageCompletionTime: number; // minutes
  commonErrors: UsageError[];
  userFeedback: UserFeedback[];
  lastUsed: Date;
}

export interface UsageError {
  error: string;
  frequency: number;
  resolution?: string;
}

export interface UserFeedback {
  rating: number; // 1-5
  comment?: string;
  suggestions?: string[];
  submittedAt: Date;
  userId: string;
}

// Template Generation Request
export interface TemplateGenerationRequest {
  entityType: EntityType;
  context: GenerationContext;
  requirements: string[]; // natural language requirements
  existingEntities?: GraphEntity[]; // for pattern learning
  customizations?: Record<string, any>;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TemplateGenerationResult {
  template: EntityTemplate;
  confidence: number; // 0-100
  reasoning: string[];
  alternatives: AlternativeTemplate[];
  warnings: string[];
  estimatedCompletionTime: number; // minutes
}

export interface AlternativeTemplate {
  template: EntityTemplate;
  reason: string;
  confidence: number;
}

// AI Template Generator
export class AITemplateGenerator {
  private config: TemplateConfig;
  private modelManager: ModelManager;
  private patternAnalyzer: PatternAnalyzer;
  private complianceMapper: ComplianceMapper;
  private templateStore: TemplateStore;
  private learningEngine: TemplateLearningEngine;

  constructor(config: TemplateConfig) {
    this.config = config;
    this.modelManager = new ModelManager(config.aiModels);
    this.patternAnalyzer = new PatternAnalyzer();
    this.complianceMapper = new ComplianceMapper();
    this.templateStore = new TemplateStore();
    this.learningEngine = new TemplateLearningEngine();
  }

  // Main template generation method
  async generateTemplate(request: TemplateGenerationRequest): Promise<TemplateGenerationResult> {
    console.log(`Generating AI template for ${request.entityType}...`);
    
    try {
      // Analyze context and requirements
      const analysisResult = await this.analyzeRequest(request);
      
      // Generate base template structure
      const baseTemplate = await this.generateBaseTemplate(request, analysisResult);
      
      // Enhance with AI-powered features
      const enhancedTemplate = await this.enhanceTemplate(baseTemplate, request, analysisResult);
      
      // Apply compliance and best practices
      const compliantTemplate = await this.applyComplianceRules(enhancedTemplate, request);
      
      // Generate alternatives
      const alternatives = await this.generateAlternatives(compliantTemplate, request);
      
      // Calculate confidence and reasoning
      const confidence = this.calculateConfidence(compliantTemplate, request, analysisResult);
      const reasoning = this.generateReasoning(compliantTemplate, request, analysisResult);
      
      // Store template for learning
      if (this.config.learningEnabled) {
        await this.templateStore.storeTemplate(compliantTemplate);
        await this.learningEngine.recordGeneration(request, compliantTemplate, confidence);
      }

      return {
        template: compliantTemplate,
        confidence,
        reasoning,
        alternatives,
        warnings: this.generateWarnings(compliantTemplate, request),
        estimatedCompletionTime: this.estimateCompletionTime(compliantTemplate)
      };

    } catch (error) {
      console.error('Template generation failed:', error);
      throw new Error(`Failed to generate template: ${error.message}`);
    }
  }

  // Request Analysis
  private async analyzeRequest(request: TemplateGenerationRequest): Promise<RequestAnalysis> {
    // Analyze technology stack
    const techStackAnalysis = await this.analyzeTechStack(request.context.techStack);
    
    // Analyze compliance requirements
    const complianceAnalysis = await this.complianceMapper.analyzeRequirements(
      request.context.complianceFrameworks
    );
    
    // Pattern analysis from existing entities
    const patternAnalysis = request.existingEntities 
      ? await this.patternAnalyzer.analyzePatterns(request.existingEntities)
      : null;
    
    // Industry-specific analysis
    const industryAnalysis = request.context.industry
      ? await this.analyzeIndustryRequirements(request.context.industry)
      : null;

    return {
      techStack: techStackAnalysis,
      compliance: complianceAnalysis,
      patterns: patternAnalysis,
      industry: industryAnalysis,
      complexity: this.assessComplexity(request),
      risks: this.identifyRisks(request)
    };
  }

  private async analyzeTechStack(techStack: string[]): Promise<TechStackAnalysis> {
    const analysis: TechStackAnalysis = {
      primaryLanguages: [],
      frameworks: [],
      databases: [],
      cloudProviders: [],
      patterns: [],
      recommendations: []
    };

    // Use AI to analyze tech stack and make recommendations
    for (const tech of techStack) {
      const category = await this.categorizeTechnology(tech);
      switch (category) {
        case 'LANGUAGE':
          analysis.primaryLanguages.push(tech);
          break;
        case 'FRAMEWORK':
          analysis.frameworks.push(tech);
          break;
        case 'DATABASE':
          analysis.databases.push(tech);
          break;
        case 'CLOUD':
          analysis.cloudProviders.push(tech);
          break;
      }
    }

    // Generate recommendations based on stack
    analysis.recommendations = await this.generateTechRecommendations(analysis);

    return analysis;
  }

  private async categorizeTechnology(tech: string): Promise<string> {
    // AI-powered technology categorization
    const categories: Record<string, string[]> = {
      'LANGUAGE': ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
      'FRAMEWORK': ['react', 'vue', 'angular', 'express', 'spring', 'django'],
      'DATABASE': ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch'],
      'CLOUD': ['aws', 'gcp', 'azure', 'kubernetes', 'docker']
    };

    for (const [category, techs] of Object.entries(categories)) {
      if (techs.some(t => tech.toLowerCase().includes(t))) {
        return category;
      }
    }

    return 'OTHER';
  }

  // Base Template Generation
  private async generateBaseTemplate(
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): Promise<EntityTemplate> {
    const templateId = `ai-${request.entityType.toLowerCase()}-${Date.now()}`;
    
    const baseTemplate: EntityTemplate = {
      id: templateId,
      name: `AI-Generated ${request.entityType} Template`,
      description: await this.generateDescription(request, analysis),
      version: '1.0.0',
      category: this.mapEntityTypeToCategory(request.entityType),
      entityType: request.entityType,
      schema: await this.generateSchema(request, analysis),
      parameters: await this.generateParameters(request, analysis),
      generationContext: request.context,
      metadata: {
        createdBy: 'AI',
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        tags: await this.generateTags(request, analysis),
        popularity: 0,
        rating: 0,
        aiConfidence: 0 // Will be calculated later
      },
      validationRules: await this.generateValidationRules(request, analysis),
      usage: {
        totalUses: 0,
        successRate: 0,
        averageCompletionTime: 0,
        commonErrors: [],
        userFeedback: [],
        lastUsed: new Date()
      }
    };

    return baseTemplate;
  }

  private async generateDescription(
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): Promise<string> {
    // Use AI to generate contextual description
    const prompt = `Generate a description for a ${request.entityType} template with the following context:
    - Technology Stack: ${request.context.techStack.join(', ')}
    - Compliance: ${request.context.complianceFrameworks.join(', ')}
    - Security Level: ${request.context.securityLevel}
    - Organization Size: ${request.context.organizationSize}
    - Requirements: ${request.requirements.join(', ')}`;

    return await this.modelManager.generateText(prompt, 'DESCRIPTION');
  }

  private async generateSchema(
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): Promise<TemplateSchema> {
    const schema: TemplateSchema = {
      required: ['name', 'description'],
      properties: {
        name: {
          type: 'string',
          description: 'Entity name',
          pattern: '^[a-zA-Z][a-zA-Z0-9-_]*$'
        },
        description: {
          type: 'string',
          description: 'Entity description',
          aiGenerated: true
        }
      }
    };

    // Add entity-type specific properties
    switch (request.entityType) {
      case EntityType.SERVICE:
        schema.properties.port = {
          type: 'number',
          description: 'Service port',
          default: 8080
        };
        schema.properties.healthCheck = {
          type: 'string',
          description: 'Health check endpoint',
          default: '/health'
        };
        break;
      
      case EntityType.API:
        schema.properties.openApiSpec = {
          type: 'string',
          description: 'OpenAPI specification URL',
          aiGenerated: true
        };
        schema.properties.version = {
          type: 'string',
          description: 'API version',
          default: '1.0.0'
        };
        break;
      
      case EntityType.DATABASE:
        schema.properties.engine = {
          type: 'enum',
          description: 'Database engine',
          enum: analysis.techStack.databases.length > 0 
            ? analysis.techStack.databases 
            : ['postgresql', 'mysql', 'mongodb']
        };
        break;
    }

    // Add compliance-specific properties
    if (analysis.compliance.requiredFields.length > 0) {
      for (const field of analysis.compliance.requiredFields) {
        schema.properties[field.name] = {
          type: field.type,
          description: field.description,
          default: field.defaultValue
        };
        if (field.required) {
          schema.required.push(field.name);
        }
      }
    }

    return schema;
  }

  private async generateParameters(
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): Promise<TemplateParameter[]> {
    const parameters: TemplateParameter[] = [
      {
        name: 'entityName',
        type: 'input',
        label: 'Entity Name',
        description: 'Unique name for the entity',
        required: true,
        validation: {
          pattern: '^[a-zA-Z][a-zA-Z0-9-_]*$',
          minLength: 3,
          maxLength: 50
        },
        placeholder: `my-${request.entityType.toLowerCase()}`
      },
      {
        name: 'description',
        type: 'input',
        label: 'Description',
        description: 'Brief description of the entity',
        required: true,
        aiAssisted: true,
        placeholder: 'Describe the purpose and functionality'
      }
    ];

    // Add context-specific parameters
    if (analysis.techStack.primaryLanguages.length > 0) {
      parameters.push({
        name: 'primaryLanguage',
        type: 'select',
        label: 'Primary Language',
        description: 'Main programming language',
        required: false,
        options: analysis.techStack.primaryLanguages.map(lang => ({
          value: lang,
          label: lang.charAt(0).toUpperCase() + lang.slice(1)
        }))
      });
    }

    if (analysis.compliance.frameworks.length > 0) {
      parameters.push({
        name: 'complianceFrameworks',
        type: 'multiselect',
        label: 'Compliance Frameworks',
        description: 'Required compliance frameworks',
        required: false,
        options: analysis.compliance.frameworks.map(framework => ({
          value: framework,
          label: framework
        }))
      });
    }

    return parameters;
  }

  // Template Enhancement
  private async enhanceTemplate(
    baseTemplate: EntityTemplate,
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): Promise<EntityTemplate> {
    // Add AI-generated dynamic properties
    baseTemplate.schema.dynamicProperties = await this.generateDynamicProperties(request, analysis);
    
    // Add conditional properties based on context
    baseTemplate.schema.conditionalProperties = await this.generateConditionalProperties(request, analysis);
    
    // Enhance parameters with AI assistance
    for (const param of baseTemplate.parameters) {
      if (param.aiAssisted) {
        // Add AI-powered default values and suggestions
        param.default = await this.generateParameterDefault(param, request, analysis);
      }
    }

    return baseTemplate;
  }

  private async generateDynamicProperties(
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): Promise<DynamicProperty[]> {
    const dynamicProperties: DynamicProperty[] = [];

    // Add AI-generated documentation
    dynamicProperties.push({
      name: 'generatedDocs',
      generator: 'generateDocumentation',
      dependencies: ['name', 'description', 'primaryLanguage'],
      cacheKey: 'docs'
    });

    // Add technology-specific configurations
    if (analysis.techStack.frameworks.length > 0) {
      dynamicProperties.push({
        name: 'frameworkConfig',
        generator: 'generateFrameworkConfig',
        dependencies: ['primaryLanguage', 'frameworks']
      });
    }

    return dynamicProperties;
  }

  private async generateConditionalProperties(
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): Promise<ConditionalProperty[]> {
    const conditionalProperties: ConditionalProperty[] = [];

    // Add security-specific properties for high-security contexts
    if (request.context.securityLevel === 'HIGH' || request.context.securityLevel === 'CRITICAL') {
      conditionalProperties.push({
        condition: 'securityLevel === "HIGH" || securityLevel === "CRITICAL"',
        properties: {
          encryptionEnabled: {
            type: 'boolean',
            description: 'Enable encryption at rest',
            default: true
          },
          auditLogging: {
            type: 'boolean',
            description: 'Enable audit logging',
            default: true
          }
        }
      });
    }

    return conditionalProperties;
  }

  // Helper Methods
  private mapEntityTypeToCategory(entityType: EntityType): TemplateCategory {
    const mapping: Record<EntityType, TemplateCategory> = {
      [EntityType.SERVICE]: TemplateCategory.MICROSERVICE,
      [EntityType.API]: TemplateCategory.API,
      [EntityType.DATABASE]: TemplateCategory.DATABASE,
      [EntityType.WEBSITE]: TemplateCategory.FRONTEND,
      [EntityType.RESOURCE]: TemplateCategory.INFRASTRUCTURE,
      [EntityType.SYSTEM]: TemplateCategory.INFRASTRUCTURE,
      [EntityType.DOMAIN]: TemplateCategory.GENERIC,
      [EntityType.GROUP]: TemplateCategory.GENERIC,
      [EntityType.USER]: TemplateCategory.GENERIC,
      [EntityType.LOCATION]: TemplateCategory.GENERIC
    };

    return mapping[entityType] || TemplateCategory.GENERIC;
  }

  private calculateConfidence(
    template: EntityTemplate,
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): number {
    let confidence = 70; // Base confidence

    // Boost for clear tech stack match
    if (analysis.techStack.primaryLanguages.length > 0) {
      confidence += 10;
    }

    // Boost for compliance coverage
    if (analysis.compliance.coverageScore > 0.8) {
      confidence += 15;
    }

    // Boost for pattern matching
    if (analysis.patterns && analysis.patterns.confidence > 0.7) {
      confidence += 10;
    }

    // Reduce for high complexity
    if (analysis.complexity === 'HIGH') {
      confidence -= 15;
    }

    return Math.min(95, Math.max(50, confidence));
  }

  private generateReasoning(
    template: EntityTemplate,
    request: TemplateGenerationRequest,
    analysis: RequestAnalysis
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Generated ${request.entityType} template based on provided context`);
    
    if (analysis.techStack.primaryLanguages.length > 0) {
      reasoning.push(`Optimized for ${analysis.techStack.primaryLanguages.join(', ')} technology stack`);
    }

    if (analysis.compliance.frameworks.length > 0) {
      reasoning.push(`Includes compliance requirements for ${analysis.compliance.frameworks.join(', ')}`);
    }

    if (request.context.securityLevel === 'HIGH') {
      reasoning.push('Enhanced security properties for high-security environment');
    }

    return reasoning;
  }

  private generateWarnings(
    template: EntityTemplate,
    request: TemplateGenerationRequest
  ): string[] {
    const warnings: string[] = [];

    if (request.context.complianceFrameworks.length > 0) {
      warnings.push('Please review compliance requirements before production use');
    }

    if (request.urgency === 'HIGH') {
      warnings.push('Template generated quickly - consider additional review');
    }

    return warnings;
  }

  private estimateCompletionTime(template: EntityTemplate): number {
    // Estimate based on template complexity
    let baseTime = 10; // 10 minutes base

    baseTime += template.parameters.length * 2; // 2 minutes per parameter
    baseTime += template.validationRules.length * 1; // 1 minute per rule
    
    if (template.schema.dynamicProperties) {
      baseTime += template.schema.dynamicProperties.length * 3; // 3 minutes per dynamic property
    }

    return baseTime;
  }

  // Placeholder methods for supporting functionality
  private async analyzeIndustryRequirements(industry: string): Promise<any> {
    return null; // Implementation would analyze industry-specific requirements
  }

  private assessComplexity(request: TemplateGenerationRequest): 'LOW' | 'MEDIUM' | 'HIGH' {
    return 'MEDIUM'; // Implementation would assess based on requirements complexity
  }

  private identifyRisks(request: TemplateGenerationRequest): any[] {
    return []; // Implementation would identify potential risks
  }

  private async generateTechRecommendations(analysis: TechStackAnalysis): Promise<string[]> {
    return []; // Implementation would generate technology recommendations
  }

  private async generateTags(request: TemplateGenerationRequest, analysis: RequestAnalysis): Promise<string[]> {
    const tags = [request.entityType.toLowerCase()];
    tags.push(...analysis.techStack.primaryLanguages.map(lang => lang.toLowerCase()));
    return tags;
  }

  private async generateValidationRules(request: TemplateGenerationRequest, analysis: RequestAnalysis): Promise<ValidationRule[]> {
    return []; // Implementation would generate validation rules
  }

  private async generateParameterDefault(param: TemplateParameter, request: TemplateGenerationRequest, analysis: RequestAnalysis): Promise<any> {
    return null; // Implementation would generate AI-powered defaults
  }

  private async applyComplianceRules(template: EntityTemplate, request: TemplateGenerationRequest): Promise<EntityTemplate> {
    return template; // Implementation would apply compliance rules
  }

  private async generateAlternatives(template: EntityTemplate, request: TemplateGenerationRequest): Promise<AlternativeTemplate[]> {
    return []; // Implementation would generate alternative templates
  }
}

// Supporting Classes and Interfaces
export class ModelManager {
  constructor(private models: AIModelConfig[]) {}
  
  async generateText(prompt: string, type: string): Promise<string> {
    // Implementation would use configured AI models
    return `AI-generated content for ${type}`;
  }
}

export class PatternAnalyzer {
  async analyzePatterns(entities: GraphEntity[]): Promise<any> {
    // Implementation would analyze patterns in existing entities
    return { confidence: 0.8 };
  }
}

export class ComplianceMapper {
  async analyzeRequirements(frameworks: string[]): Promise<any> {
    // Implementation would map compliance requirements
    return {
      frameworks,
      requiredFields: [],
      coverageScore: 0.9
    };
  }
}

export class TemplateStore {
  async storeTemplate(template: EntityTemplate): Promise<void> {
    // Implementation would store templates
  }
}

export class TemplateLearningEngine {
  async recordGeneration(request: TemplateGenerationRequest, template: EntityTemplate, confidence: number): Promise<void> {
    // Implementation would record generation for learning
  }
}

// Additional Types
export interface RequestAnalysis {
  techStack: TechStackAnalysis;
  compliance: any;
  patterns: any;
  industry: any;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  risks: any[];
}

export interface TechStackAnalysis {
  primaryLanguages: string[];
  frameworks: string[];
  databases: string[];
  cloudProviders: string[];
  patterns: string[];
  recommendations: string[];
}

export interface CustomTemplate {
  id: string;
  name: string;
  template: EntityTemplate;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  rule: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export interface DefaultParameters {
  timeout: number;
  retries: number;
  cacheEnabled: boolean;
}