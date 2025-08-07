/**
 * Advanced Template Engine for Service Scaffolding
 * 
 * Provides intelligent template processing with conditional logic,
 * multi-technology stack support, and dynamic parameter injection.
 */

import * as yaml from 'js-yaml';
import { z } from 'zod';
import Mustache from 'mustache';
import { promises as fs } from 'fs';
import path from 'path';

// Template schema validation
const TemplateParameterSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'select', 'multiselect', 'object']),
  title: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  default: z.any().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string()
  })).optional(),
  validation: z.object({
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  condition: z.string().optional() // JavaScript expression for conditional display
});

const TemplateStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  action: z.string(),
  input: z.record(z.any()),
  condition: z.string().optional(),
  if: z.string().optional()
});

const TemplateSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Template'),
  metadata: z.object({
    name: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    version: z.string().default('1.0.0'),
    maintainer: z.string().optional(),
    icon: z.string().optional(),
    category: z.string().default('service'),
    technology: z.array(z.string()).default([]),
    complexity: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    estimatedTime: z.string().optional()
  }),
  spec: z.object({
    owner: z.string(),
    type: z.string(),
    parameters: z.array(TemplateParameterSchema),
    steps: z.array(TemplateStepSchema),
    output: z.object({
      entities: z.array(z.object({
        kind: z.string(),
        spec: z.record(z.any())
      })).optional(),
      links: z.array(z.object({
        url: z.string(),
        title: z.string(),
        icon: z.string().optional()
      })).optional()
    }).optional()
  }),
  conditions: z.record(z.string()).optional(), // Global conditions
  inheritance: z.object({
    extends: z.string().optional(),
    overrides: z.record(z.any()).optional()
  }).optional()
});

export type TemplateParameter = z.infer<typeof TemplateParameterSchema>;
export type TemplateStep = z.infer<typeof TemplateStepSchema>;
export type Template = z.infer<typeof TemplateSchema>;

export interface TemplateContext {
  parameters: Record<string, any>;
  user: {
    name: string;
    email: string;
    entity?: string;
  };
  timestamp: string;
  environment: 'development' | 'staging' | 'production';
  organization: {
    name: string;
    domain: string;
  };
}

export interface TemplateExecutionResult {
  success: boolean;
  outputs: Record<string, any>;
  entities: Array<{
    kind: string;
    metadata: Record<string, any>;
    spec: Record<string, any>;
  }>;
  links: Array<{
    url: string;
    title: string;
    icon?: string;
  }>;
  artifacts: Array<{
    path: string;
    content: string;
    type: 'file' | 'directory';
  }>;
  errors?: Array<{
    step: string;
    message: string;
    details?: any;
  }>;
}

export class AdvancedTemplateEngine {
  private templateCache = new Map<string, Template>();
  private actionRegistry = new Map<string, TemplateAction>();

  constructor(
    private templateRoot: string,
    private workspaceRoot: string
  ) {
    this.registerDefaultActions();
  }

  /**
   * Load and validate a template from file
   */
  async loadTemplate(templatePath: string): Promise<Template> {
    const cacheKey = templatePath;
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    try {
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const templateData = yaml.load(templateContent) as any;
      
      // Handle template inheritance
      if (templateData.inheritance?.extends) {
        const parentTemplate = await this.loadTemplate(
          path.resolve(path.dirname(templatePath), templateData.inheritance.extends)
        );
        templateData = this.mergeTemplates(parentTemplate, templateData);
      }

      const template = TemplateSchema.parse(templateData);
      this.templateCache.set(cacheKey, template);
      
      return template;
    } catch (error) {
      throw new Error(`Failed to load template ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Execute a template with given context
   */
  async executeTemplate(
    template: Template,
    context: TemplateContext
  ): Promise<TemplateExecutionResult> {
    const result: TemplateExecutionResult = {
      success: true,
      outputs: {},
      entities: [],
      links: [],
      artifacts: [],
      errors: []
    };

    try {
      // Validate parameters
      this.validateParameters(template.spec.parameters, context.parameters);

      // Execute steps
      for (const step of template.spec.steps) {
        try {
          // Check step condition
          if (step.condition && !this.evaluateCondition(step.condition, context)) {
            continue;
          }

          const action = this.actionRegistry.get(step.action);
          if (!action) {
            throw new Error(`Unknown action: ${step.action}`);
          }

          // Process input with templating
          const processedInput = this.processTemplateInput(step.input, context);
          
          const stepResult = await action.execute(processedInput, context);
          
          // Merge step outputs
          Object.assign(result.outputs, stepResult.outputs || {});
          result.entities.push(...(stepResult.entities || []));
          result.links.push(...(stepResult.links || []));
          result.artifacts.push(...(stepResult.artifacts || []));

        } catch (error) {
          result.errors.push({
            step: step.id,
            message: error.message,
            details: error
          });
          result.success = false;
        }
      }

      // Process template outputs
      if (template.spec.output) {
        if (template.spec.output.entities) {
          result.entities.push(...template.spec.output.entities.map(entity => ({
            ...entity,
            metadata: this.processObject(entity.metadata || {}, context),
            spec: this.processObject(entity.spec, context)
          })));
        }

        if (template.spec.output.links) {
          result.links.push(...template.spec.output.links.map(link => ({
            ...link,
            url: this.processString(link.url, context),
            title: this.processString(link.title, context)
          })));
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push({
        step: 'template-execution',
        message: error.message,
        details: error
      });
    }

    return result;
  }

  /**
   * Get available templates with filtering and search
   */
  async getAvailableTemplates(filters?: {
    technology?: string[];
    category?: string;
    complexity?: string;
    search?: string;
  }): Promise<Template[]> {
    const templateFiles = await this.findTemplateFiles(this.templateRoot);
    const templates: Template[] = [];

    for (const templateFile of templateFiles) {
      try {
        const template = await this.loadTemplate(templateFile);
        
        // Apply filters
        if (this.matchesFilters(template, filters)) {
          templates.push(template);
        }
      } catch (error) {
        console.warn(`Failed to load template ${templateFile}: ${error.message}`);
      }
    }

    return templates.sort((a, b) => a.metadata.title.localeCompare(b.metadata.title));
  }

  /**
   * Validate template parameters against provided values
   */
  validateParameters(parameters: TemplateParameter[], values: Record<string, any>): void {
    for (const param of parameters) {
      const value = values[param.name];

      // Check required parameters
      if (param.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      this.validateParameterType(param, value);

      // Custom validation
      if (param.validation) {
        this.validateParameterConstraints(param, value);
      }
    }
  }

  /**
   * Evaluate condition expressions
   */
  evaluateCondition(condition: string, context: TemplateContext): boolean {
    try {
      // Create safe evaluation context
      const evalContext = {
        parameters: context.parameters,
        user: context.user,
        environment: context.environment,
        organization: context.organization
      };

      // Use a safer evaluation method (in production, consider using a proper expression parser)
      const func = new Function('context', `with(context) { return ${condition}; }`);
      return Boolean(func(evalContext));
    } catch (error) {
      console.warn(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  /**
   * Process template strings with Mustache
   */
  private processString(template: string, context: TemplateContext): string {
    return Mustache.render(template, {
      ...context.parameters,
      user: context.user,
      timestamp: context.timestamp,
      environment: context.environment,
      organization: context.organization
    });
  }

  /**
   * Process template objects recursively
   */
  private processObject(obj: any, context: TemplateContext): any {
    if (typeof obj === 'string') {
      return this.processString(obj, context);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.processObject(item, context));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[this.processString(key, context)] = this.processObject(value, context);
      }
      return result;
    }
    return obj;
  }

  /**
   * Process template input with context
   */
  private processTemplateInput(input: Record<string, any>, context: TemplateContext): Record<string, any> {
    return this.processObject(input, context);
  }

  /**
   * Merge parent and child templates for inheritance
   */
  private mergeTemplates(parent: Template, child: any): any {
    const merged = JSON.parse(JSON.stringify(parent));
    
    // Merge metadata
    if (child.metadata) {
      Object.assign(merged.metadata, child.metadata);
    }

    // Merge parameters
    if (child.spec?.parameters) {
      merged.spec.parameters = [...merged.spec.parameters, ...child.spec.parameters];
    }

    // Merge steps
    if (child.spec?.steps) {
      merged.spec.steps = [...merged.spec.steps, ...child.spec.steps];
    }

    // Apply overrides
    if (child.inheritance?.overrides) {
      this.applyOverrides(merged, child.inheritance.overrides);
    }

    return merged;
  }

  /**
   * Apply template overrides
   */
  private applyOverrides(target: any, overrides: Record<string, any>): void {
    for (const [path, value] of Object.entries(overrides)) {
      this.setNestedProperty(target, path, value);
    }
  }

  /**
   * Set nested property using dot notation
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Find all template files recursively
   */
  private async findTemplateFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.findTemplateFiles(fullPath));
        } else if (entry.name === 'template.yaml' || entry.name === 'template.yml') {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  /**
   * Check if template matches given filters
   */
  private matchesFilters(template: Template, filters?: any): boolean {
    if (!filters) return true;

    if (filters.technology && filters.technology.length > 0) {
      const hasMatchingTech = filters.technology.some((tech: string) =>
        template.metadata.technology.includes(tech)
      );
      if (!hasMatchingTech) return false;
    }

    if (filters.category && template.metadata.category !== filters.category) {
      return false;
    }

    if (filters.complexity && template.metadata.complexity !== filters.complexity) {
      return false;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableText = [
        template.metadata.title,
        template.metadata.description,
        ...template.metadata.tags
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(param: TemplateParameter, value: any): void {
    switch (param.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`Parameter '${param.name}' must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Parameter '${param.name}' must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Parameter '${param.name}' must be a boolean`);
        }
        break;
      case 'select':
        if (param.options && !param.options.some(option => option.value === value)) {
          throw new Error(`Parameter '${param.name}' must be one of: ${param.options.map(o => o.value).join(', ')}`);
        }
        break;
      case 'multiselect':
        if (!Array.isArray(value)) {
          throw new Error(`Parameter '${param.name}' must be an array`);
        }
        if (param.options) {
          const validValues = param.options.map(o => o.value);
          const invalidValues = value.filter(v => !validValues.includes(v));
          if (invalidValues.length > 0) {
            throw new Error(`Parameter '${param.name}' contains invalid values: ${invalidValues.join(', ')}`);
          }
        }
        break;
    }
  }

  /**
   * Validate parameter constraints
   */
  private validateParameterConstraints(param: TemplateParameter, value: any): void {
    const validation = param.validation!;

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        throw new Error(`Parameter '${param.name}' does not match required pattern`);
      }
    }

    if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
      throw new Error(`Parameter '${param.name}' must be at least ${validation.minLength} characters long`);
    }

    if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
      throw new Error(`Parameter '${param.name}' must be at most ${validation.maxLength} characters long`);
    }

    if (validation.min && typeof value === 'number' && value < validation.min) {
      throw new Error(`Parameter '${param.name}' must be at least ${validation.min}`);
    }

    if (validation.max && typeof value === 'number' && value > validation.max) {
      throw new Error(`Parameter '${param.name}' must be at most ${validation.max}`);
    }
  }

  /**
   * Register default template actions
   */
  private registerDefaultActions(): void {
    // Register built-in actions
    this.actionRegistry.set('fetch:template', new FetchTemplateAction());
    this.actionRegistry.set('fs:write', new WriteFileAction());
    this.actionRegistry.set('fs:copy', new CopyFileAction());
    this.actionRegistry.set('fs:rename', new RenameAction());
    this.actionRegistry.set('git:init', new GitInitAction());
    this.actionRegistry.set('catalog:register', new CatalogRegisterAction());
  }

  /**
   * Register custom template action
   */
  registerAction(name: string, action: TemplateAction): void {
    this.actionRegistry.set(name, action);
  }
}

// Template action interface
export interface TemplateAction {
  execute(input: Record<string, any>, context: TemplateContext): Promise<{
    outputs?: Record<string, any>;
    entities?: Array<{ kind: string; metadata: any; spec: any }>;
    links?: Array<{ url: string; title: string; icon?: string }>;
    artifacts?: Array<{ path: string; content: string; type: 'file' | 'directory' }>;
  }>;
}

// Built-in actions
class FetchTemplateAction implements TemplateAction {
  async execute(input: Record<string, any>): Promise<any> {
    // Implementation for fetching and processing template files
    return {
      outputs: { templateFetched: true },
      artifacts: []
    };
  }
}

class WriteFileAction implements TemplateAction {
  async execute(input: Record<string, any>): Promise<any> {
    // Implementation for writing files
    const { path: filePath, contents } = input;
    return {
      outputs: { fileWritten: filePath },
      artifacts: [{ path: filePath, content: contents, type: 'file' as const }]
    };
  }
}

class CopyFileAction implements TemplateAction {
  async execute(input: Record<string, any>): Promise<any> {
    // Implementation for copying files
    return { outputs: {}, artifacts: [] };
  }
}

class RenameAction implements TemplateAction {
  async execute(input: Record<string, any>): Promise<any> {
    // Implementation for renaming files
    return { outputs: {}, artifacts: [] };
  }
}

class GitInitAction implements TemplateAction {
  async execute(input: Record<string, any>): Promise<any> {
    // Implementation for git initialization
    return { outputs: { gitInitialized: true }, artifacts: [] };
  }
}

class CatalogRegisterAction implements TemplateAction {
  async execute(input: Record<string, any>): Promise<any> {
    // Implementation for catalog registration
    return {
      outputs: { catalogRegistered: true },
      entities: [{
        kind: input.kind || 'Component',
        metadata: input.metadata || {},
        spec: input.spec || {}
      }]
    };
  }
}