/**
 * Template Engine Service
 * Manages software templates and their execution
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SoftwareTemplate,
  TemplateParameter,
  TemplateStep,
  TemplateExecution,
  StepExecution,
  ExecutionStatus,
  StepStatus,
  TemplateCategory,
  TemplateType,
  DryRunResult,
  TemplateFilterOptions,
  TemplateListResponse,
} from './types';

// Step action handlers
type StepHandler = (
  step: TemplateStep,
  context: ExecutionContext
) => Promise<StepResult>;

interface ExecutionContext {
  templateId: string;
  executionId: string;
  parameters: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  userId: string;
}

interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  logs?: string[];
}

export class TemplateEngine {
  private templates: Map<string, SoftwareTemplate> = new Map();
  private executions: Map<string, TemplateExecution> = new Map();
  private stepHandlers: Map<string, StepHandler> = new Map();

  constructor() {
    this.registerDefaultStepHandlers();
    this.initializeDefaultTemplates();
  }

  // ============================================================================
  // Template CRUD
  // ============================================================================

  async createTemplate(
    template: Omit<SoftwareTemplate, 'id' | 'metadata'>
  ): Promise<SoftwareTemplate> {
    const now = new Date().toISOString();
    const newTemplate: SoftwareTemplate = {
      ...template,
      id: uuidv4(),
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: 'current-user',
        updatedBy: 'current-user',
        version: '1.0.0',
        status: 'draft',
        popularity: 0,
        usageCount: 0,
      },
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async getTemplate(id: string): Promise<SoftwareTemplate | null> {
    return this.templates.get(id) || null;
  }

  async listTemplates(options?: TemplateFilterOptions): Promise<TemplateListResponse> {
    let results = Array.from(this.templates.values());

    if (options) {
      // Filter by category
      if (options.category) {
        results = results.filter((t) => t.category === options.category);
      }

      // Filter by type
      if (options.type) {
        results = results.filter((t) => t.type === options.type);
      }

      // Filter by owner
      if (options.owner) {
        results = results.filter((t) => t.owner === options.owner);
      }

      // Filter by status
      if (options.status) {
        results = results.filter((t) => t.metadata.status === options.status);
      }

      // Filter by golden path
      if (options.goldenPath !== undefined) {
        results = results.filter(
          (t) => t.goldenPath?.enabled === options.goldenPath
        );
      }

      // Search
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        results = results.filter(
          (t) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.title.toLowerCase().includes(searchLower) ||
            t.description.toLowerCase().includes(searchLower)
        );
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        results = results.filter((t) =>
          options.tags!.some((tag) => t.tags.includes(tag))
        );
      }
    }

    // Sort by popularity and usage
    results.sort((a, b) => {
      const aScore = a.metadata.popularity + a.metadata.usageCount;
      const bScore = b.metadata.popularity + b.metadata.usageCount;
      return bScore - aScore;
    });

    return {
      templates: results,
      total: results.length,
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false,
      },
    };
  }

  async updateTemplate(
    id: string,
    updates: Partial<SoftwareTemplate>
  ): Promise<SoftwareTemplate | null> {
    const existing = this.templates.get(id);
    if (!existing) return null;

    const updated: SoftwareTemplate = {
      ...existing,
      ...updates,
      id,
      metadata: {
        ...existing.metadata,
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
      },
    };

    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  // ============================================================================
  // Template Execution
  // ============================================================================

  async executeTemplate(
    templateId: string,
    parameters: Record<string, unknown>,
    userId: string,
    dryRun = false
  ): Promise<{ execution: TemplateExecution; dryRunResult?: DryRunResult }> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate parameters
    const validationErrors = this.validateParameters(template, parameters);
    if (validationErrors.length > 0) {
      throw new Error(`Parameter validation failed: ${validationErrors.join(', ')}`);
    }

    // If dry run, return validation result
    if (dryRun) {
      const dryRunResult = this.performDryRun(template, parameters);
      const execution = this.createExecution(template, parameters, userId);
      return { execution, dryRunResult };
    }

    // Create execution record
    const execution = this.createExecution(template, parameters, userId);
    this.executions.set(execution.id, execution);

    // Execute steps asynchronously
    this.runExecution(execution, template, parameters, userId);

    return { execution };
  }

  private createExecution(
    template: SoftwareTemplate,
    parameters: Record<string, unknown>,
    userId: string
  ): TemplateExecution {
    return {
      id: uuidv4(),
      templateId: template.id,
      templateVersion: template.metadata.version,
      userId,
      status: 'pending',
      parameters,
      steps: template.steps.map((step) => ({
        stepId: step.id,
        stepName: step.name,
        status: 'pending' as StepStatus,
      })),
      startedAt: new Date().toISOString(),
    };
  }

  private async runExecution(
    execution: TemplateExecution,
    template: SoftwareTemplate,
    parameters: Record<string, unknown>,
    userId: string
  ): Promise<void> {
    execution.status = 'running';
    this.executions.set(execution.id, execution);

    const context: ExecutionContext = {
      templateId: template.id,
      executionId: execution.id,
      parameters,
      stepOutputs: {},
      userId,
    };

    try {
      for (let i = 0; i < template.steps.length; i++) {
        const step = template.steps[i];
        const stepExecution = execution.steps[i];

        // Check conditional
        if (step.if && !this.evaluateCondition(step.if, context)) {
          stepExecution.status = 'skipped';
          continue;
        }

        stepExecution.status = 'running';
        stepExecution.startedAt = new Date().toISOString();
        this.executions.set(execution.id, execution);

        try {
          const result = await this.executeStep(step, context);

          if (result.success) {
            stepExecution.status = 'completed';
            stepExecution.output = result.output;
            if (result.output) {
              context.stepOutputs[step.id] = result.output;
            }
          } else {
            stepExecution.status = 'failed';
            stepExecution.error = result.error;

            if (!step.continueOnError) {
              throw new Error(`Step ${step.name} failed: ${result.error}`);
            }
          }

          stepExecution.logs = result.logs;
        } catch (error) {
          stepExecution.status = 'failed';
          stepExecution.error = String(error);

          if (!step.continueOnError) {
            throw error;
          }
        }

        stepExecution.completedAt = new Date().toISOString();
        stepExecution.duration = stepExecution.startedAt
          ? new Date(stepExecution.completedAt).getTime() -
            new Date(stepExecution.startedAt).getTime()
          : undefined;
      }

      // Compute outputs
      execution.outputs = this.computeOutputs(template, context);
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.duration =
        new Date(execution.completedAt).getTime() -
        new Date(execution.startedAt).getTime();

      // Update template usage count
      template.metadata.usageCount++;
      this.templates.set(template.id, template);
    } catch (error) {
      execution.status = 'failed';
      execution.error = String(error);
      execution.completedAt = new Date().toISOString();
    }

    this.executions.set(execution.id, execution);
  }

  private async executeStep(
    step: TemplateStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const handler = this.stepHandlers.get(step.action);
    if (!handler) {
      return {
        success: false,
        error: `Unknown action: ${step.action}`,
      };
    }

    // Resolve input values
    const resolvedInput = this.resolveValues(step.input, context);
    const resolvedStep = { ...step, input: resolvedInput };

    return handler(resolvedStep, context);
  }

  // ============================================================================
  // Parameter Validation
  // ============================================================================

  private validateParameters(
    template: SoftwareTemplate,
    parameters: Record<string, unknown>
  ): string[] {
    const errors: string[] = [];

    for (const param of template.parameters) {
      const value = parameters[param.name];

      // Required check
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push(`${param.title} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // Type check
      const typeValid = this.validateType(value, param.type);
      if (!typeValid) {
        errors.push(`${param.title} must be of type ${param.type}`);
      }

      // Validation rules
      if (param.validation) {
        if (param.validation.pattern) {
          const regex = new RegExp(param.validation.pattern);
          if (!regex.test(String(value))) {
            errors.push(
              param.validation.patternMessage ||
                `${param.title} does not match required pattern`
            );
          }
        }

        if (param.validation.minLength && String(value).length < param.validation.minLength) {
          errors.push(
            `${param.title} must be at least ${param.validation.minLength} characters`
          );
        }

        if (param.validation.maxLength && String(value).length > param.validation.maxLength) {
          errors.push(
            `${param.title} must be at most ${param.validation.maxLength} characters`
          );
        }

        if (param.validation.min !== undefined && Number(value) < param.validation.min) {
          errors.push(`${param.title} must be at least ${param.validation.min}`);
        }

        if (param.validation.max !== undefined && Number(value) > param.validation.max) {
          errors.push(`${param.title} must be at most ${param.validation.max}`);
        }

        if (param.validation.enum && !param.validation.enum.includes(String(value))) {
          errors.push(
            `${param.title} must be one of: ${param.validation.enum.join(', ')}`
          );
        }
      }
    }

    return errors;
  }

  private validateType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
      case 'entity-ref':
      case 'user-ref':
      case 'group-ref':
      case 'repo-picker':
      case 'owner-picker':
      case 'component-picker':
      case 'secret':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
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

  // ============================================================================
  // Dry Run
  // ============================================================================

  private performDryRun(
    template: SoftwareTemplate,
    parameters: Record<string, unknown>
  ): DryRunResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const resourcesCreated: string[] = [];

    // Check requirements
    if (template.requirements) {
      for (const req of template.requirements) {
        // In production, actually check requirements
        warnings.push(`Requirement check: ${req.type} - ${req.value}`);
      }
    }

    // Estimate resources
    for (const step of template.steps) {
      if (step.action.includes('create') || step.action.includes('publish')) {
        const input = this.resolveValues(step.input, {
          templateId: template.id,
          executionId: 'dry-run',
          parameters,
          stepOutputs: {},
          userId: 'dry-run',
        });
        resourcesCreated.push(`${step.action}: ${JSON.stringify(input).slice(0, 100)}`);
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      estimatedSteps: template.steps.length,
      estimatedDuration: template.metadata.averageExecutionTime,
      resourcesCreated,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private resolveValues(
    input: Record<string, unknown>,
    context: ExecutionContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      resolved[key] = this.resolveValue(value, context);
    }

    return resolved;
  }

  private resolveValue(value: unknown, context: ExecutionContext): unknown {
    if (typeof value === 'string') {
      // Replace ${{ parameters.xxx }} syntax
      let resolved = value.replace(
        /\$\{\{\s*parameters\.(\w+)\s*\}\}/g,
        (_, paramName) => String(context.parameters[paramName] ?? '')
      );

      // Replace ${{ steps.xxx.output.yyy }} syntax
      resolved = resolved.replace(
        /\$\{\{\s*steps\.(\w+)\.output\.(\w+)\s*\}\}/g,
        (_, stepId, outputKey) => {
          const stepOutput = context.stepOutputs[stepId];
          if (stepOutput && typeof stepOutput === 'object') {
            return String((stepOutput as Record<string, unknown>)[outputKey] ?? '');
          }
          return '';
        }
      );

      return resolved;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context));
    }

    if (typeof value === 'object' && value !== null) {
      return this.resolveValues(value as Record<string, unknown>, context);
    }

    return value;
  }

  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple condition evaluation
    // In production, use a proper expression evaluator
    try {
      const resolved = this.resolveValue(condition, context);
      return Boolean(resolved);
    } catch {
      return false;
    }
  }

  private computeOutputs(
    template: SoftwareTemplate,
    context: ExecutionContext
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};

    for (const output of template.outputs) {
      outputs[output.name] = this.resolveValue(output.value, context);
    }

    return outputs;
  }

  // ============================================================================
  // Execution Management
  // ============================================================================

  async getExecution(id: string): Promise<TemplateExecution | null> {
    return this.executions.get(id) || null;
  }

  async listExecutions(templateId?: string, userId?: string): Promise<TemplateExecution[]> {
    let results = Array.from(this.executions.values());

    if (templateId) {
      results = results.filter((e) => e.templateId === templateId);
    }

    if (userId) {
      results = results.filter((e) => e.userId === userId);
    }

    return results.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  async cancelExecution(id: string): Promise<boolean> {
    const execution = this.executions.get(id);
    if (!execution || execution.status !== 'running') {
      return false;
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date().toISOString();
    this.executions.set(id, execution);
    return true;
  }

  // ============================================================================
  // Step Handlers
  // ============================================================================

  registerStepHandler(action: string, handler: StepHandler): void {
    this.stepHandlers.set(action, handler);
  }

  private registerDefaultStepHandlers(): void {
    // Fetch template handler
    this.registerStepHandler('fetch:template', async (step, context) => {
      // In production, fetch and process template files
      return {
        success: true,
        output: { files: ['skeleton processed'] },
        logs: [`Fetched template from ${step.input.url || 'local'}`],
      };
    });

    // Fetch plain files handler
    this.registerStepHandler('fetch:plain', async (step, context) => {
      return {
        success: true,
        output: { files: ['files fetched'] },
        logs: [`Fetched files from ${step.input.url}`],
      };
    });

    // Catalog register handler
    this.registerStepHandler('catalog:register', async (step, context) => {
      return {
        success: true,
        output: { entityRef: `component:default/${context.parameters.name}` },
        logs: ['Entity registered in catalog'],
      };
    });

    // GitHub repo create handler
    this.registerStepHandler('github:repo:create', async (step, context) => {
      return {
        success: true,
        output: {
          repoUrl: `https://github.com/${step.input.owner}/${step.input.name}`,
          repoContentsUrl: `https://github.com/${step.input.owner}/${step.input.name}/tree/main`,
        },
        logs: ['GitHub repository created'],
      };
    });

    // GitHub repo push handler
    this.registerStepHandler('github:repo:push', async (step, context) => {
      return {
        success: true,
        output: { commitSha: 'abc123' },
        logs: ['Code pushed to repository'],
      };
    });

    // Publish to GitHub handler
    this.registerStepHandler('publish:github', async (step, context) => {
      return {
        success: true,
        output: {
          repoUrl: `https://github.com/${step.input.repoOwner}/${step.input.repoName}`,
        },
        logs: ['Published to GitHub'],
      };
    });

    // HTTP request handler
    this.registerStepHandler('http:request', async (step, context) => {
      return {
        success: true,
        output: { statusCode: 200, body: {} },
        logs: [`HTTP ${step.input.method || 'GET'} ${step.input.url}`],
      };
    });

    // Slack notify handler
    this.registerStepHandler('slack:notify', async (step, context) => {
      return {
        success: true,
        logs: [`Slack notification sent to ${step.input.channel}`],
      };
    });

    // Custom action handler
    this.registerStepHandler('custom:action', async (step, context) => {
      return {
        success: true,
        logs: ['Custom action executed'],
      };
    });
  }

  // ============================================================================
  // Default Templates
  // ============================================================================

  private initializeDefaultTemplates(): void {
    const templates: Omit<SoftwareTemplate, 'id' | 'metadata'>[] = [
      {
        name: 'nodejs-microservice',
        title: 'Node.js Microservice',
        description: 'Create a production-ready Node.js microservice with Express, TypeScript, Docker, and CI/CD',
        owner: 'platform-team',
        category: 'backend',
        type: 'create',
        tags: ['nodejs', 'typescript', 'microservice', 'docker', 'express'],
        parameters: [
          {
            id: 'name',
            name: 'name',
            title: 'Service Name',
            description: 'The name of the service',
            type: 'string',
            required: true,
            ui: { component: 'text', placeholder: 'my-service' },
            validation: { pattern: '^[a-z][a-z0-9-]*$', patternMessage: 'Must be lowercase with dashes' },
          },
          {
            id: 'description',
            name: 'description',
            title: 'Description',
            type: 'string',
            required: true,
            ui: { component: 'textarea', placeholder: 'Describe what this service does' },
          },
          {
            id: 'owner',
            name: 'owner',
            title: 'Owner',
            type: 'owner-picker',
            required: true,
            ui: { component: 'owner-picker' },
          },
          {
            id: 'system',
            name: 'system',
            title: 'System',
            type: 'entity-ref',
            required: false,
            ui: { component: 'entity-picker', entityKind: 'System' },
          },
        ],
        steps: [
          {
            id: 'fetch',
            name: 'Fetch Template',
            title: 'Fetch skeleton code',
            action: 'fetch:template',
            input: {
              url: 'https://github.com/company/templates/nodejs-microservice',
              values: {
                name: '${{ parameters.name }}',
                description: '${{ parameters.description }}',
              },
            },
          },
          {
            id: 'publish',
            name: 'Publish',
            title: 'Publish to GitHub',
            action: 'publish:github',
            input: {
              repoOwner: 'company',
              repoName: '${{ parameters.name }}',
              description: '${{ parameters.description }}',
            },
          },
          {
            id: 'register',
            name: 'Register',
            title: 'Register in catalog',
            action: 'catalog:register',
            input: {
              catalogInfoPath: '/catalog-info.yaml',
            },
          },
        ],
        outputs: [
          {
            id: 'repo',
            name: 'Repository',
            title: 'Repository URL',
            type: 'link',
            value: '${{ steps.publish.output.repoUrl }}',
          },
          {
            id: 'entity',
            name: 'Entity',
            title: 'Catalog Entity',
            type: 'entity-ref',
            value: '${{ steps.register.output.entityRef }}',
          },
        ],
        goldenPath: {
          enabled: true,
          recommended: true,
          maturityLevel: 'advanced',
          compliance: ['SOC2', 'GDPR'],
          features: [
            { name: 'TypeScript', description: 'Fully typed with TypeScript', included: true, optional: false },
            { name: 'Docker', description: 'Containerized with Docker', included: true, optional: false },
            { name: 'CI/CD', description: 'GitHub Actions pipeline', included: true, optional: false },
            { name: 'Tests', description: 'Jest test setup', included: true, optional: false },
            { name: 'Monitoring', description: 'Prometheus metrics', included: true, optional: true },
          ],
        },
      },
      {
        name: 'react-frontend',
        title: 'React Frontend Application',
        description: 'Create a modern React frontend with Next.js, TypeScript, and Tailwind CSS',
        owner: 'platform-team',
        category: 'frontend',
        type: 'create',
        tags: ['react', 'nextjs', 'typescript', 'frontend', 'tailwind'],
        parameters: [
          {
            id: 'name',
            name: 'name',
            title: 'Application Name',
            type: 'string',
            required: true,
            ui: { component: 'text', placeholder: 'my-app' },
            validation: { pattern: '^[a-z][a-z0-9-]*$' },
          },
          {
            id: 'description',
            name: 'description',
            title: 'Description',
            type: 'string',
            required: true,
            ui: { component: 'textarea' },
          },
          {
            id: 'owner',
            name: 'owner',
            title: 'Owner',
            type: 'owner-picker',
            required: true,
            ui: { component: 'owner-picker' },
          },
        ],
        steps: [
          {
            id: 'fetch',
            name: 'Fetch Template',
            title: 'Fetch skeleton',
            action: 'fetch:template',
            input: { url: 'https://github.com/company/templates/react-frontend' },
          },
          {
            id: 'publish',
            name: 'Publish',
            title: 'Publish to GitHub',
            action: 'publish:github',
            input: {
              repoOwner: 'company',
              repoName: '${{ parameters.name }}',
            },
          },
          {
            id: 'register',
            name: 'Register',
            title: 'Register in catalog',
            action: 'catalog:register',
            input: { catalogInfoPath: '/catalog-info.yaml' },
          },
        ],
        outputs: [
          {
            id: 'repo',
            name: 'Repository',
            title: 'Repository URL',
            type: 'link',
            value: '${{ steps.publish.output.repoUrl }}',
          },
        ],
        goldenPath: {
          enabled: true,
          recommended: true,
          maturityLevel: 'intermediate',
          compliance: [],
          features: [
            { name: 'Next.js 14', description: 'App router with RSC', included: true, optional: false },
            { name: 'Tailwind CSS', description: 'Utility-first styling', included: true, optional: false },
            { name: 'Testing', description: 'Jest + React Testing Library', included: true, optional: false },
          ],
        },
      },
    ];

    // Create templates
    for (const template of templates) {
      this.createTemplate(template);
    }
  }
}

// Singleton instance
let instance: TemplateEngine | null = null;

export function getTemplateEngine(): TemplateEngine {
  if (!instance) {
    instance = new TemplateEngine();
  }
  return instance;
}

export default TemplateEngine;
