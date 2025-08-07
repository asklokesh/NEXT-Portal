import { TemplateParameter, SmartParameter, ValidationResult } from './types';

export class DynamicParameterEngine {
  private static instance: DynamicParameterEngine;
  private aiAssistant: ParameterAIAssistant;
  private validationEngine: SmartValidationEngine;
  private suggestionEngine: ParameterSuggestionEngine;
  private contextAnalyzer: ParameterContextAnalyzer;

  private constructor() {
    this.aiAssistant = new ParameterAIAssistant();
    this.validationEngine = new SmartValidationEngine();
    this.suggestionEngine = new ParameterSuggestionEngine();
    this.contextAnalyzer = new ParameterContextAnalyzer();
  }

  static getInstance(): DynamicParameterEngine {
    if (!this.instance) {
      this.instance = new DynamicParameterEngine();
    }
    return this.instance;
  }

  /**
   * Generate smart parameters based on template context
   */
  async generateSmartParameters(
    templateContext: TemplateContext,
    userContext: UserContext
  ): Promise<SmartParameter[]> {
    const baseParameters = await this.generateBaseParameters(templateContext);
    const contextualParameters = await this.generateContextualParameters(templateContext, userContext);
    
    const allParameters = [...baseParameters, ...contextualParameters];
    const smartParameters: SmartParameter[] = [];

    for (const param of allParameters) {
      const smartParam = await this.enhanceParameter(param, templateContext, userContext);
      smartParameters.push(smartParam);
    }

    return this.optimizeParameterOrder(smartParameters, userContext);
  }

  /**
   * Enhance existing parameter with AI capabilities
   */
  async enhanceParameter(
    parameter: TemplateParameter,
    templateContext: TemplateContext,
    userContext: UserContext
  ): Promise<SmartParameter> {
    const suggestions = await this.suggestionEngine.generateSuggestions(
      parameter,
      templateContext,
      userContext
    );

    const validation = await this.validationEngine.createValidation(
      parameter,
      templateContext
    );

    const context = await this.contextAnalyzer.analyze(
      parameter,
      templateContext,
      userContext
    );

    const autoComplete = await this.shouldAutoComplete(parameter, userContext);

    return {
      parameter: await this.optimizeParameter(parameter, suggestions, context),
      suggestions,
      validation,
      autoComplete,
      context
    };
  }

  /**
   * Validate parameter value with AI assistance
   */
  async validateParameterValue(
    parameter: TemplateParameter,
    value: any,
    context: TemplateContext
  ): Promise<ValidationResult> {
    return await this.validationEngine.validate(parameter, value, context);
  }

  /**
   * Auto-fill parameter based on context and user history
   */
  async autoFillParameter(
    parameter: TemplateParameter,
    context: AutoFillContext
  ): Promise<any> {
    return await this.aiAssistant.autoFill(parameter, context);
  }

  /**
   * Get suggestions for parameter value
   */
  async getSuggestions(
    parameter: TemplateParameter,
    currentValue: any,
    context: TemplateContext,
    userContext: UserContext
  ): Promise<string[]> {
    return await this.suggestionEngine.getSuggestions(
      parameter,
      currentValue,
      context,
      userContext
    );
  }

  /**
   * Create conditional parameters based on other parameter values
   */
  async createConditionalParameters(
    baseParameters: TemplateParameter[],
    currentValues: Record<string, any>,
    context: TemplateContext
  ): Promise<TemplateParameter[]> {
    const conditionalParams: TemplateParameter[] = [];

    for (const param of baseParameters) {
      if (param.ui?.conditional) {
        const shouldShow = this.evaluateCondition(
          param.ui.conditional,
          currentValues
        );

        if (shouldShow) {
          const enhancedParam = await this.enhanceConditionalParameter(
            param,
            currentValues,
            context
          );
          conditionalParams.push(enhancedParam);
        }
      }
    }

    // Generate new conditional parameters based on AI analysis
    const aiGeneratedParams = await this.aiAssistant.generateConditionalParameters(
      currentValues,
      context
    );

    return [...conditionalParams, ...aiGeneratedParams];
  }

  /**
   * Smart parameter grouping and organization
   */
  async organizeParameters(
    parameters: SmartParameter[],
    userPreferences: UserParameterPreferences
  ): Promise<ParameterGroup[]> {
    const groups = await this.aiAssistant.groupParameters(parameters, userPreferences);
    return this.optimizeGroupOrder(groups, userPreferences);
  }

  /**
   * Generate parameter help and documentation
   */
  async generateParameterHelp(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<ParameterHelp> {
    return await this.aiAssistant.generateHelp(parameter, context);
  }

  /**
   * Learn from parameter usage patterns
   */
  async learnFromUsage(
    parameter: TemplateParameter,
    value: any,
    outcome: ParameterUsageOutcome,
    context: TemplateContext
  ): Promise<void> {
    await this.aiAssistant.learn(parameter, value, outcome, context);
    await this.suggestionEngine.updateFromUsage(parameter, value, outcome);
    await this.validationEngine.learnFromValidation(parameter, value, outcome);
  }

  // Private helper methods
  private async generateBaseParameters(context: TemplateContext): Promise<TemplateParameter[]> {
    const baseParams: TemplateParameter[] = [
      {
        name: 'name',
        title: 'Project Name',
        description: 'The name of your project',
        type: 'string',
        required: true,
        validation: {
          pattern: '^[a-z][a-z0-9-]*$',
          min: 3,
          max: 50
        },
        ui: {
          widget: 'text',
          placeholder: 'my-awesome-project'
        }
      },
      {
        name: 'description',
        title: 'Description',
        description: 'A brief description of your project',
        type: 'string',
        required: true,
        ui: {
          widget: 'textarea',
          placeholder: 'Describe what this project does...'
        }
      }
    ];

    // Add technology-specific parameters
    if (context.technologies.includes('typescript')) {
      baseParams.push({
        name: 'strictMode',
        title: 'TypeScript Strict Mode',
        description: 'Enable strict type checking',
        type: 'boolean',
        default: true,
        ui: {
          widget: 'checkbox'
        }
      });
    }

    if (context.technologies.includes('react')) {
      baseParams.push({
        name: 'uiFramework',
        title: 'UI Framework',
        description: 'Choose your UI component library',
        type: 'select',
        enum: ['shadcn/ui', 'material-ui', 'chakra-ui', 'ant-design'],
        default: 'shadcn/ui'
      });
    }

    return baseParams;
  }

  private async generateContextualParameters(
    templateContext: TemplateContext,
    userContext: UserContext
  ): Promise<TemplateParameter[]> {
    const contextualParams: TemplateParameter[] = [];

    // Team size based parameters
    if (userContext.teamSize && userContext.teamSize > 5) {
      contextualParams.push({
        name: 'codeReviewProcess',
        title: 'Code Review Process',
        description: 'Select code review workflow for your team',
        type: 'select',
        enum: ['pull-request', 'merge-request', 'custom'],
        default: 'pull-request'
      });
    }

    // Compliance based parameters
    if (templateContext.compliance && templateContext.compliance.length > 0) {
      contextualParams.push({
        name: 'complianceLevel',
        title: 'Compliance Level',
        description: 'Required compliance standards',
        type: 'multiselect',
        enum: templateContext.compliance,
        required: true
      });
    }

    // Environment based parameters
    if (templateContext.deploymentTargets) {
      contextualParams.push({
        name: 'environment',
        title: 'Target Environment',
        description: 'Where will this be deployed?',
        type: 'select',
        enum: templateContext.deploymentTargets,
        default: templateContext.deploymentTargets[0]
      });
    }

    return contextualParams;
  }

  private async optimizeParameter(
    parameter: TemplateParameter,
    suggestions: string[],
    context: any
  ): Promise<TemplateParameter> {
    const optimized = { ...parameter };

    // Enhance UI based on suggestions
    if (suggestions.length > 0 && !optimized.ui?.help) {
      optimized.ui = {
        ...optimized.ui,
        help: `Suggestions: ${suggestions.slice(0, 3).join(', ')}`
      };
    }

    // Add smart defaults based on context
    if (!optimized.default && context.businessRules.length > 0) {
      const smartDefault = await this.inferSmartDefault(parameter, context);
      if (smartDefault) {
        optimized.default = smartDefault;
      }
    }

    // Enhance validation based on context
    if (context.constraints.length > 0) {
      optimized.validation = {
        ...optimized.validation,
        custom: this.generateCustomValidation(context.constraints)
      };
    }

    return optimized;
  }

  private async shouldAutoComplete(
    parameter: TemplateParameter,
    userContext: UserContext
  ): boolean {
    // Auto-complete for experienced users with common parameters
    if (userContext.experience === 'expert' && this.isCommonParameter(parameter)) {
      return true;
    }

    // Auto-complete if user has strong preferences
    if (userContext.preferences?.[parameter.name]) {
      return true;
    }

    return false;
  }

  private optimizeParameterOrder(
    parameters: SmartParameter[],
    userContext: UserContext
  ): SmartParameter[] {
    // Sort parameters by importance and user preferences
    return parameters.sort((a, b) => {
      // Required parameters first
      if (a.parameter.required && !b.parameter.required) return -1;
      if (!a.parameter.required && b.parameter.required) return 1;

      // User-preferred parameters next
      const aUserPreference = this.getUserPreferenceScore(a.parameter, userContext);
      const bUserPreference = this.getUserPreferenceScore(b.parameter, userContext);
      if (aUserPreference !== bUserPreference) return bUserPreference - aUserPreference;

      // Auto-completable parameters later
      if (a.autoComplete && !b.autoComplete) return 1;
      if (!a.autoComplete && b.autoComplete) return -1;

      return 0;
    });
  }

  private evaluateCondition(
    condition: { field: string; value: any },
    currentValues: Record<string, any>
  ): boolean {
    const fieldValue = currentValues[condition.field];
    
    if (Array.isArray(condition.value)) {
      return condition.value.includes(fieldValue);
    }
    
    return fieldValue === condition.value;
  }

  private async enhanceConditionalParameter(
    parameter: TemplateParameter,
    currentValues: Record<string, any>,
    context: TemplateContext
  ): Promise<TemplateParameter> {
    // Enhance parameter based on current form state
    const enhanced = { ...parameter };

    // Update enum options based on other selections
    if (enhanced.enum) {
      enhanced.enum = await this.filterEnumOptions(
        enhanced.enum,
        currentValues,
        context
      );
    }

    // Update default value based on current context
    if (!enhanced.default) {
      enhanced.default = await this.calculateContextualDefault(
        parameter,
        currentValues,
        context
      );
    }

    return enhanced;
  }

  private optimizeGroupOrder(
    groups: ParameterGroup[],
    preferences: UserParameterPreferences
  ): ParameterGroup[] {
    const priorityOrder = preferences.groupPriority || [
      'basic',
      'configuration',
      'advanced',
      'deployment'
    ];

    return groups.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.category) ?? 999;
      const bPriority = priorityOrder.indexOf(b.category) ?? 999;
      return aPriority - bPriority;
    });
  }

  private isCommonParameter(parameter: TemplateParameter): boolean {
    const commonParams = ['name', 'description', 'version', 'author'];
    return commonParams.includes(parameter.name);
  }

  private getUserPreferenceScore(
    parameter: TemplateParameter,
    userContext: UserContext
  ): number {
    if (userContext.preferences?.[parameter.name]) return 10;
    if (userContext.recentlyUsed?.includes(parameter.name)) return 5;
    return 0;
  }

  private async filterEnumOptions(
    options: string[],
    currentValues: Record<string, any>,
    context: TemplateContext
  ): Promise<string[]> {
    // Filter options based on current form state and context
    return options.filter(option => {
      return this.isOptionRelevant(option, currentValues, context);
    });
  }

  private isOptionRelevant(
    option: string,
    currentValues: Record<string, any>,
    context: TemplateContext
  ): boolean {
    // Simple relevance check - can be enhanced with AI
    const technology = currentValues.technology;
    
    // Filter UI frameworks based on selected technology
    if (option.includes('react') && !technology?.includes('react')) return false;
    if (option.includes('vue') && !technology?.includes('vue')) return false;
    if (option.includes('angular') && !technology?.includes('angular')) return false;

    return true;
  }

  private async calculateContextualDefault(
    parameter: TemplateParameter,
    currentValues: Record<string, any>,
    context: TemplateContext
  ): Promise<any> {
    // Calculate smart default based on context
    if (parameter.name === 'port' && currentValues.type === 'api') {
      return 3000;
    }

    if (parameter.name === 'database' && currentValues.scale === 'large') {
      return 'postgresql';
    }

    return null;
  }

  private async inferSmartDefault(
    parameter: TemplateParameter,
    context: any
  ): Promise<any> {
    // Use AI to infer smart defaults
    const businessRules = context.businessRules;
    
    for (const rule of businessRules) {
      if (rule.parameter === parameter.name) {
        return rule.defaultValue;
      }
    }

    return null;
  }

  private generateCustomValidation(constraints: string[]): string {
    // Generate custom validation logic from constraints
    const validationRules = constraints.map(constraint => {
      return this.constraintToValidationRule(constraint);
    });

    return validationRules.join(' && ');
  }

  private constraintToValidationRule(constraint: string): string {
    // Convert business constraint to validation rule
    if (constraint.includes('min length')) {
      const match = constraint.match(/min length (\d+)/);
      return match ? `value.length >= ${match[1]}` : 'true';
    }

    if (constraint.includes('alphanumeric')) {
      return '/^[a-zA-Z0-9]+$/.test(value)';
    }

    return 'true'; // Default to true for unknown constraints
  }
}

// Supporting classes
class ParameterAIAssistant {
  async autoFill(parameter: TemplateParameter, context: AutoFillContext): Promise<any> {
    // Use AI to auto-fill parameter values
    const userHistory = context.userHistory || [];
    const templateContext = context.templateContext;

    // Check user's historical values for this parameter
    const historicalValues = userHistory
      .filter(usage => usage.parameters[parameter.name])
      .map(usage => usage.parameters[parameter.name]);

    if (historicalValues.length > 0) {
      // Return most common value
      const valueCounts = new Map<any, number>();
      historicalValues.forEach(value => {
        valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
      });

      const mostCommon = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      
      return mostCommon[0];
    }

    // AI-based inference
    return await this.inferValueFromContext(parameter, templateContext);
  }

  async generateConditionalParameters(
    currentValues: Record<string, any>,
    context: TemplateContext
  ): Promise<TemplateParameter[]> {
    const conditionalParams: TemplateParameter[] = [];

    // Generate parameters based on current selections
    if (currentValues.database === 'postgresql') {
      conditionalParams.push({
        name: 'pgExtensions',
        title: 'PostgreSQL Extensions',
        description: 'Select required extensions',
        type: 'multiselect',
        enum: ['uuid-ossp', 'pg_crypto', 'hstore', 'postgis'],
        default: ['uuid-ossp']
      });
    }

    if (currentValues.authentication === 'oauth') {
      conditionalParams.push({
        name: 'oauthProvider',
        title: 'OAuth Provider',
        description: 'Choose OAuth provider',
        type: 'select',
        enum: ['google', 'github', 'microsoft', 'custom'],
        required: true
      });
    }

    return conditionalParams;
  }

  async groupParameters(
    parameters: SmartParameter[],
    preferences: UserParameterPreferences
  ): Promise<ParameterGroup[]> {
    const groups = new Map<string, ParameterGroup>();

    for (const param of parameters) {
      const category = this.categorizeParameter(param.parameter);
      
      if (!groups.has(category)) {
        groups.set(category, {
          id: category,
          name: this.formatCategoryName(category),
          category,
          parameters: [],
          collapsible: category !== 'basic',
          defaultExpanded: category === 'basic'
        });
      }

      groups.get(category)!.parameters.push(param);
    }

    return Array.from(groups.values());
  }

  async generateHelp(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<ParameterHelp> {
    return {
      description: parameter.description,
      examples: await this.generateExamples(parameter, context),
      tips: await this.generateTips(parameter, context),
      commonMistakes: await this.getCommonMistakes(parameter),
      relatedParameters: this.findRelatedParameters(parameter, context),
      documentation: await this.findDocumentation(parameter)
    };
  }

  async learn(
    parameter: TemplateParameter,
    value: any,
    outcome: ParameterUsageOutcome,
    context: TemplateContext
  ): Promise<void> {
    // Store learning data for improving AI recommendations
    const learningData = {
      parameter: parameter.name,
      value,
      outcome,
      context: {
        technology: context.technologies,
        complexity: context.complexity,
        timestamp: new Date().toISOString()
      }
    };

    // In a real implementation, this would be stored in a database
    console.log('Learning from parameter usage:', learningData);
  }

  private async inferValueFromContext(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<any> {
    // AI inference based on context
    const inferences = {
      name: () => this.generateProjectName(context),
      description: () => this.generateDescription(context),
      author: () => context.userEmail || 'developer@example.com',
      version: () => '1.0.0'
    };

    const inferenceFunc = inferences[parameter.name as keyof typeof inferences];
    return inferenceFunc ? inferenceFunc() : parameter.default;
  }

  private generateProjectName(context: TemplateContext): string {
    const technology = context.technologies[0] || 'app';
    const type = context.templateType || 'service';
    return `${technology}-${type}-${Date.now().toString(36)}`;
  }

  private generateDescription(context: TemplateContext): string {
    const tech = context.technologies.join(', ');
    const type = context.templateType || 'application';
    return `A ${type} built with ${tech}`;
  }

  private categorizeParameter(parameter: TemplateParameter): string {
    const basicParams = ['name', 'description', 'author', 'version'];
    const deploymentParams = ['environment', 'region', 'scale'];
    const securityParams = ['authentication', 'authorization', 'encryption'];
    const advancedParams = ['performance', 'monitoring', 'logging'];

    if (basicParams.includes(parameter.name)) return 'basic';
    if (deploymentParams.includes(parameter.name)) return 'deployment';
    if (securityParams.includes(parameter.name)) return 'security';
    if (advancedParams.includes(parameter.name)) return 'advanced';
    
    return 'configuration';
  }

  private formatCategoryName(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  private async generateExamples(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<string[]> {
    const examples: Record<string, string[]> = {
      name: ['my-api-service', 'user-management-app', 'payment-gateway'],
      description: ['RESTful API for user management', 'React dashboard for analytics'],
      version: ['1.0.0', '0.1.0', '2.3.1']
    };

    return examples[parameter.name] || [parameter.default].filter(Boolean);
  }

  private async generateTips(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<string[]> {
    const tips: Record<string, string[]> = {
      name: ['Use lowercase with hyphens', 'Keep it descriptive but concise'],
      description: ['Include the main purpose', 'Mention key technologies used'],
      version: ['Follow semantic versioning', 'Start with 0.1.0 for new projects']
    };

    return tips[parameter.name] || [];
  }

  private async getCommonMistakes(parameter: TemplateParameter): Promise<string[]> {
    const mistakes: Record<string, string[]> = {
      name: ['Using spaces instead of hyphens', 'Making it too long'],
      version: ['Not following semantic versioning', 'Starting with 0.0.0']
    };

    return mistakes[parameter.name] || [];
  }

  private findRelatedParameters(
    parameter: TemplateParameter,
    context: TemplateContext
  ): string[] {
    const relationships: Record<string, string[]> = {
      name: ['description', 'repository'],
      database: ['port', 'environment'],
      authentication: ['authorization', 'session']
    };

    return relationships[parameter.name] || [];
  }

  private async findDocumentation(parameter: TemplateParameter): Promise<string[]> {
    // Return relevant documentation links
    return [
      `https://docs.saas-idp.com/parameters/${parameter.name}`,
      `https://backstage.io/docs/features/software-templates/writing-templates#${parameter.name}`
    ];
  }
}

class SmartValidationEngine {
  async createValidation(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<ValidationResult> {
    return {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: await this.generateValidationSuggestions(parameter, context)
    };
  }

  async validate(
    parameter: TemplateParameter,
    value: any,
    context: TemplateContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (parameter.required && !value) {
      errors.push(`${parameter.title} is required`);
    }

    // Type validation
    if (value && !this.validateType(value, parameter.type)) {
      errors.push(`${parameter.title} must be of type ${parameter.type}`);
    }

    // Pattern validation
    if (value && parameter.validation?.pattern) {
      const regex = new RegExp(parameter.validation.pattern);
      if (!regex.test(value)) {
        errors.push(`${parameter.title} format is invalid`);
        suggestions.push(`Expected format: ${parameter.validation.pattern}`);
      }
    }

    // Length validation
    if (value && typeof value === 'string') {
      if (parameter.validation?.min && value.length < parameter.validation.min) {
        errors.push(`${parameter.title} must be at least ${parameter.validation.min} characters`);
      }
      if (parameter.validation?.max && value.length > parameter.validation.max) {
        errors.push(`${parameter.title} must be no more than ${parameter.validation.max} characters`);
      }
    }

    // Enum validation
    if (value && parameter.enum && !parameter.enum.includes(value)) {
      errors.push(`${parameter.title} must be one of: ${parameter.enum.join(', ')}`);
    }

    // AI-powered validation
    const aiValidation = await this.performAIValidation(parameter, value, context);
    warnings.push(...aiValidation.warnings);
    suggestions.push(...aiValidation.suggestions);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  async learnFromValidation(
    parameter: TemplateParameter,
    value: any,
    outcome: ParameterUsageOutcome
  ): Promise<void> {
    // Learn from validation outcomes to improve future validations
    if (!outcome.success && outcome.validationErrors) {
      // Record common validation failures for better error messages
      console.log(`Learning from validation failure for ${parameter.name}:`, outcome.validationErrors);
    }
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  private async generateValidationSuggestions(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (parameter.name === 'name' && context.technologies.includes('docker')) {
      suggestions.push('Use lowercase letters, numbers, and hyphens for Docker compatibility');
    }

    if (parameter.name === 'port' && context.templateType === 'api') {
      suggestions.push('Use ports 3000-8000 for development, avoid system ports');
    }

    return suggestions;
  }

  private async performAIValidation(
    parameter: TemplateParameter,
    value: any,
    context: TemplateContext
  ): Promise<{ warnings: string[]; suggestions: string[] }> {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // AI-powered semantic validation
    if (parameter.name === 'name' && typeof value === 'string') {
      if (value.includes('test') && context.environment === 'production') {
        warnings.push('Project name contains "test" but targeting production');
        suggestions.push('Consider using a production-appropriate name');
      }
    }

    if (parameter.name === 'database' && value === 'sqlite' && context.scale === 'large') {
      warnings.push('SQLite may not be suitable for large-scale applications');
      suggestions.push('Consider PostgreSQL or MySQL for better scalability');
    }

    return { warnings, suggestions };
  }
}

class ParameterSuggestionEngine {
  private usageHistory: Map<string, any[]> = new Map();

  async generateSuggestions(
    parameter: TemplateParameter,
    templateContext: TemplateContext,
    userContext: UserContext
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Historical suggestions from user
    const userSuggestions = this.getUserHistoricalSuggestions(parameter.name, userContext);
    suggestions.push(...userSuggestions);

    // Context-based suggestions
    const contextSuggestions = this.getContextualSuggestions(parameter, templateContext);
    suggestions.push(...contextSuggestions);

    // AI-generated suggestions
    const aiSuggestions = await this.generateAISuggestions(parameter, templateContext);
    suggestions.push(...aiSuggestions);

    // Remove duplicates and limit to top 5
    return [...new Set(suggestions)].slice(0, 5);
  }

  async getSuggestions(
    parameter: TemplateParameter,
    currentValue: any,
    context: TemplateContext,
    userContext: UserContext
  ): Promise<string[]> {
    // Real-time suggestions based on current input
    const suggestions: string[] = [];

    if (parameter.enum) {
      // Filter enum options based on current input
      const filtered = parameter.enum.filter(option =>
        option.toLowerCase().includes((currentValue || '').toLowerCase())
      );
      suggestions.push(...filtered);
    }

    // AI-powered autocomplete
    const aiSuggestions = await this.generateAutocompleteSuggestions(
      parameter,
      currentValue,
      context
    );
    suggestions.push(...aiSuggestions);

    return suggestions.slice(0, 10);
  }

  async updateFromUsage(
    parameter: TemplateParameter,
    value: any,
    outcome: ParameterUsageOutcome
  ): Promise<void> {
    if (outcome.success) {
      // Add successful value to suggestions
      const history = this.usageHistory.get(parameter.name) || [];
      history.push(value);
      this.usageHistory.set(parameter.name, history.slice(-50)); // Keep last 50
    }
  }

  private getUserHistoricalSuggestions(
    parameterName: string,
    userContext: UserContext
  ): string[] {
    return userContext.parameterHistory?.[parameterName] || [];
  }

  private getContextualSuggestions(
    parameter: TemplateParameter,
    context: TemplateContext
  ): string[] {
    const suggestions: string[] = [];

    if (parameter.name === 'name') {
      const tech = context.technologies[0] || 'app';
      suggestions.push(`${tech}-service`, `my-${tech}-app`);
    }

    if (parameter.name === 'database' && context.technologies.includes('node')) {
      suggestions.push('postgresql', 'mongodb');
    }

    return suggestions;
  }

  private async generateAISuggestions(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<string[]> {
    // AI-powered suggestion generation
    const suggestions: string[] = [];

    // Use template context to generate relevant suggestions
    if (parameter.type === 'string' && parameter.name === 'description') {
      const tech = context.technologies.join(' and ');
      suggestions.push(`A modern application built with ${tech}`);
    }

    return suggestions;
  }

  private async generateAutocompleteSuggestions(
    parameter: TemplateParameter,
    currentValue: string,
    context: TemplateContext
  ): Promise<string[]> {
    if (!currentValue || currentValue.length < 2) return [];

    const suggestions: string[] = [];
    
    // Fuzzy match against common values
    const commonValues = this.getCommonValues(parameter, context);
    const fuzzyMatches = commonValues.filter(value =>
      value.toLowerCase().includes(currentValue.toLowerCase())
    );
    
    suggestions.push(...fuzzyMatches);

    return suggestions.slice(0, 5);
  }

  private getCommonValues(parameter: TemplateParameter, context: TemplateContext): string[] {
    const commonValues: Record<string, string[]> = {
      database: ['postgresql', 'mysql', 'mongodb', 'sqlite', 'redis'],
      language: ['typescript', 'javascript', 'python', 'java', 'go'],
      framework: ['react', 'vue', 'angular', 'express', 'fastify'],
      cloud: ['aws', 'gcp', 'azure', 'digitalocean']
    };

    return commonValues[parameter.name] || [];
  }
}

class ParameterContextAnalyzer {
  async analyze(
    parameter: TemplateParameter,
    templateContext: TemplateContext,
    userContext: UserContext
  ): Promise<{
    relatedFields: string[];
    businessRules: string[];
    constraints: string[];
  }> {
    const relatedFields = this.findRelatedFields(parameter, templateContext);
    const businessRules = await this.extractBusinessRules(parameter, templateContext);
    const constraints = this.identifyConstraints(parameter, templateContext, userContext);

    return {
      relatedFields,
      businessRules,
      constraints
    };
  }

  private findRelatedFields(parameter: TemplateParameter, context: TemplateContext): string[] {
    const relationships: Record<string, string[]> = {
      database: ['port', 'username', 'password'],
      authentication: ['session', 'security'],
      deployment: ['environment', 'region', 'scale']
    };

    return relationships[parameter.name] || [];
  }

  private async extractBusinessRules(
    parameter: TemplateParameter,
    context: TemplateContext
  ): Promise<string[]> {
    const rules: string[] = [];

    // Extract rules from template context
    if (context.compliance.includes('gdpr') && parameter.name.includes('data')) {
      rules.push('GDPR compliance required for data handling');
    }

    if (context.scale === 'enterprise' && parameter.name === 'database') {
      rules.push('High availability database required for enterprise scale');
    }

    return rules;
  }

  private identifyConstraints(
    parameter: TemplateParameter,
    templateContext: TemplateContext,
    userContext: UserContext
  ): string[] {
    const constraints: string[] = [];

    // Technical constraints
    if (parameter.name === 'port' && templateContext.platform === 'kubernetes') {
      constraints.push('Port must be > 1024 for non-root containers');
    }

    // Business constraints
    if (userContext.organization?.policies?.namingConvention) {
      constraints.push(`Must follow naming convention: ${userContext.organization.policies.namingConvention}`);
    }

    return constraints;
  }
}

// Type definitions
interface TemplateContext {
  technologies: string[];
  templateType: string;
  complexity: string;
  scale: string;
  compliance: string[];
  environment: string;
  platform: string;
  deploymentTargets?: string[];
  userEmail?: string;
}

interface UserContext {
  userId: string;
  experience: 'beginner' | 'intermediate' | 'expert';
  teamSize?: number;
  preferences?: Record<string, any>;
  recentlyUsed?: string[];
  parameterHistory?: Record<string, string[]>;
  organization?: {
    policies?: {
      namingConvention?: string;
    };
  };
}

interface AutoFillContext {
  userHistory?: TemplateUsage[];
  templateContext: TemplateContext;
  similarTemplates?: string[];
}

interface TemplateUsage {
  templateId: string;
  parameters: Record<string, any>;
  outcome: 'success' | 'failure';
  timestamp: string;
}

interface UserParameterPreferences {
  groupPriority?: string[];
  showAdvanced?: boolean;
  autoFillPreferences?: string[];
}

interface ParameterGroup {
  id: string;
  name: string;
  category: string;
  parameters: SmartParameter[];
  collapsible: boolean;
  defaultExpanded: boolean;
}

interface ParameterHelp {
  description: string;
  examples: string[];
  tips: string[];
  commonMistakes: string[];
  relatedParameters: string[];
  documentation: string[];
}

interface ParameterUsageOutcome {
  success: boolean;
  validationErrors?: string[];
  executionTime?: number;
  userSatisfaction?: number;
}