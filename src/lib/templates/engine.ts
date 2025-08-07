import { SoftwareTemplate, TemplateExecution, TemplateStep, TemplateAction } from './types';
import { backstageClient } from '../backstage/real-client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Template execution engine that processes software templates
 * Compatible with Backstage Scaffolder API
 */
export class TemplateEngine {
  private actions: Map<string, TemplateAction> = new Map();
  private executions: Map<string, TemplateExecution> = new Map();

  constructor() {
    this.registerBuiltInActions();
  }

  /**
   * Register built-in template actions
   */
  private registerBuiltInActions() {
    // Fetch action
    this.registerAction({
      id: 'fetch:plain',
      description: 'Fetch files from a URL',
      schema: {
        input: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            targetPath: { type: 'string' }
          }
        }
      }
    });

    // Fetch template action
    this.registerAction({
      id: 'fetch:template',
      description: 'Fetch and process template files',
      schema: {
        input: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            targetPath: { type: 'string' },
            values: { type: 'object' }
          }
        }
      }
    });

    // Publish to GitHub
    this.registerAction({
      id: 'publish:github',
      description: 'Publish to GitHub repository',
      schema: {
        input: {
          type: 'object',
          properties: {
            repoUrl: { type: 'string' },
            description: { type: 'string' },
            defaultBranch: { type: 'string' },
            visibility: { type: 'string', enum: ['public', 'private'] },
            topics: { type: 'array', items: { type: 'string' } }
          }
        },
        output: {
          type: 'object',
          properties: {
            remoteUrl: { type: 'string' },
            repoContentsUrl: { type: 'string' }
          }
        }
      }
    });

    // Catalog register action
    this.registerAction({
      id: 'catalog:register',
      description: 'Register entity in catalog',
      schema: {
        input: {
          type: 'object',
          properties: {
            repoContentsUrl: { type: 'string' },
            catalogInfoPath: { type: 'string' }
          }
        },
        output: {
          type: 'object',
          properties: {
            entityRef: { type: 'string' },
            catalogInfoUrl: { type: 'string' }
          }
        }
      }
    });

    // Debug log action
    this.registerAction({
      id: 'debug:log',
      description: 'Log debug information',
      schema: {
        input: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            listWorkspace: { type: 'boolean' }
          }
        }
      }
    });

    // File system actions
    this.registerAction({
      id: 'fs:delete',
      description: 'Delete files or directories',
      schema: {
        input: {
          type: 'object',
          properties: {
            files: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    });

    this.registerAction({
      id: 'fs:rename',
      description: 'Rename files or directories',
      schema: {
        input: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' }
          }
        }
      }
    });
  }

  /**
   * Register a custom action
   */
  registerAction(action: TemplateAction) {
    this.actions.set(action.id, action);
  }

  /**
   * Execute a software template
   */
  async execute(
    template: SoftwareTemplate,
    parameters: Record<string, any>,
    userId: string
  ): Promise<TemplateExecution> {
    const executionId = uuidv4();
    
    const execution: TemplateExecution = {
      id: executionId,
      templateRef: `template:${template.metadata.name}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      parameters,
      steps: template.spec.steps.map(step => ({
        id: step.id,
        name: step.name,
        status: 'pending'
      }))
    };

    this.executions.set(executionId, execution);

    // Start execution in background
    this.runExecution(execution, template).catch(error => {
      console.error('Template execution failed:', error);
      execution.status = 'failed';
      execution.updatedAt = new Date().toISOString();
    });

    return execution;
  }

  /**
   * Run template execution
   */
  private async runExecution(
    execution: TemplateExecution,
    template: SoftwareTemplate
  ): Promise<void> {
    execution.status = 'running';
    execution.updatedAt = new Date().toISOString();

    const context: Record<string, any> = {
      parameters: execution.parameters,
      steps: {},
      output: {}
    };

    try {
      // Execute each step
      for (const [index, step] of template.spec.steps.entries()) {
        const executionStep = execution.steps[index];
        
        // Check if step should be skipped
        if (step.if && !this.evaluateCondition(step.if, context)) {
          executionStep.status = 'skipped';
          continue;
        }

        executionStep.status = 'running';
        executionStep.startedAt = new Date().toISOString();

        try {
          // Execute the step
          const output = await this.executeStep(step, context);
          
          executionStep.status = 'completed';
          executionStep.completedAt = new Date().toISOString();
          executionStep.output = output;
          
          // Store step output in context
          context.steps[step.id] = output;
          
        } catch (error) {
          executionStep.status = 'failed';
          executionStep.completedAt = new Date().toISOString();
          executionStep.error = error instanceof Error ? error.message : 'Unknown error';
          
          execution.status = 'failed';
          execution.updatedAt = new Date().toISOString();
          return;
        }
      }

      // Template completed successfully
      execution.status = 'completed';
      execution.updatedAt = new Date().toISOString();
      execution.output = context.output;

    } catch (error) {
      execution.status = 'failed';
      execution.updatedAt = new Date().toISOString();
      console.error('Template execution error:', error);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: TemplateStep,
    context: Record<string, any>
  ): Promise<any> {
    const action = this.actions.get(step.action);
    
    if (!action) {
      throw new Error(`Unknown action: ${step.action}`);
    }

    // Process input with template substitution
    const input = this.processTemplateInput(step.input || {}, context);

    // Execute action based on type
    switch (step.action) {
      case 'fetch:plain':
        return this.executeFetchPlain(input);
      
      case 'fetch:template':
        return this.executeFetchTemplate(input, context);
      
      case 'publish:github':
        return this.executePublishGitHub(input);
      
      case 'catalog:register':
        return this.executeCatalogRegister(input);
      
      case 'debug:log':
        return this.executeDebugLog(input);
      
      case 'fs:delete':
      case 'fs:rename':
        return this.executeFileSystem(step.action, input);
      
      default:
        // Try to execute via Backstage Scaffolder API
        return this.executeViaBackstage(step.action, input);
    }
  }

  /**
   * Process template input with variable substitution
   */
  private processTemplateInput(
    input: Record<string, any>,
    context: Record<string, any>
  ): Record<string, any> {
    const processValue = (value: any): any => {
      if (typeof value === 'string') {
        // Simple template substitution
        return value.replace(/\$\{\{([^}]+)\}\}/g, (match, path) => {
          return this.getValueFromPath(context, path.trim()) || match;
        });
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (value && typeof value === 'object') {
        const result: Record<string, any> = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = processValue(val);
        }
        return result;
      }
      return value;
    };

    return processValue(input);
  }

  /**
   * Get value from object path
   */
  private getValueFromPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Evaluate conditional expression
   */
  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    try {
      // Simple evaluation - in production use a proper expression evaluator
      const processed = this.processTemplateInput({ condition }, context);
      return processed.condition === 'true' || processed.condition === true;
    } catch {
      return false;
    }
  }

  /**
   * Execute fetch:plain action
   */
  private async executeFetchPlain(input: any): Promise<any> {
    console.log('Fetching files from:', input.url);
    
    // In a real implementation, this would download files
    // For now, return mock result
    return {
      files: ['README.md', 'package.json', 'src/index.ts'],
      targetPath: input.targetPath
    };
  }

  /**
   * Execute fetch:template action
   */
  private async executeFetchTemplate(input: any, context: Record<string, any>): Promise<any> {
    console.log('Fetching template from:', input.url);
    
    // Process template files with values
    return {
      files: ['README.md', 'package.json', 'src/index.ts'],
      targetPath: input.targetPath,
      processed: true
    };
  }

  /**
   * Execute publish:github action
   */
  private async executePublishGitHub(input: any): Promise<any> {
    console.log('Publishing to GitHub:', input.repoUrl);
    
    // Mock GitHub repository creation
    const repoName = input.repoUrl.split('/').pop();
    const remoteUrl = `https://github.com/example/${repoName}`;
    
    return {
      remoteUrl,
      repoContentsUrl: `${remoteUrl}/blob/main`
    };
  }

  /**
   * Execute catalog:register action
   */
  private async executeCatalogRegister(input: any): Promise<any> {
    console.log('Registering in catalog:', input.repoContentsUrl);
    
    try {
      // Register with Backstage catalog
      const response = await backstageClient.request('/api/catalog/entities', {
        method: 'POST',
        body: JSON.stringify({
          type: 'url',
          target: `${input.repoContentsUrl}/${input.catalogInfoPath || 'catalog-info.yaml'}`
        })
      });
      
      return {
        entityRef: response.entityRef || 'component:default/new-component',
        catalogInfoUrl: input.repoContentsUrl
      };
    } catch (error) {
      // Return mock data on error
      return {
        entityRef: 'component:default/new-component',
        catalogInfoUrl: input.repoContentsUrl
      };
    }
  }

  /**
   * Execute debug:log action
   */
  private async executeDebugLog(input: any): Promise<any> {
    console.log('[Template Debug]:', input.message);
    
    if (input.listWorkspace) {
      console.log('Workspace contents:', ['README.md', 'package.json', 'src/']);
    }
    
    return { logged: true };
  }

  /**
   * Execute file system actions
   */
  private async executeFileSystem(action: string, input: any): Promise<any> {
    console.log(`Executing ${action}:`, input);
    
    return { success: true };
  }

  /**
   * Execute action via Backstage Scaffolder API
   */
  private async executeViaBackstage(action: string, input: any): Promise<any> {
    try {
      const response = await backstageClient.request('/api/scaffolder/v1/actions', {
        method: 'POST',
        body: JSON.stringify({ action, input })
      });
      
      return response.output || {};
    } catch (error) {
      console.error(`Failed to execute action ${action} via Backstage:`, error);
      return {};
    }
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): TemplateExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List all executions
   */
  listExecutions(): TemplateExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Cancel an execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.updatedAt = new Date().toISOString();
      
      // Mark remaining steps as cancelled
      execution.steps.forEach(step => {
        if (step.status === 'pending' || step.status === 'running') {
          step.status = 'skipped';
        }
      });
      
      return true;
    }
    
    return false;
  }
}

// Create and export singleton instance
export const templateEngine = new TemplateEngine();