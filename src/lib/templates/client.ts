import { SoftwareTemplate, TemplateExecution, TemplateFilter } from './types';
import { backstageClient } from '../backstage/real-client';

/**
 * Client for managing software templates
 */
export class TemplateClient {
  /**
   * List available templates
   */
  async listTemplates(filter?: TemplateFilter): Promise<SoftwareTemplate[]> {
    try {
      const params = new URLSearchParams();
      
      if (filter?.tags?.length) {
        params.append('tags', filter.tags.join(','));
      }
      if (filter?.owner) {
        params.append('owner', filter.owner);
      }
      if (filter?.type) {
        params.append('type', filter.type);
      }
      if (filter?.lifecycle) {
        params.append('lifecycle', filter.lifecycle);
      }
      if (filter?.search) {
        params.append('search', filter.search);
      }
      
      const queryString = params.toString();
      const url = `/api/scaffolder/v1/templates${queryString ? `?${queryString}` : ''}`;
      
      const response = await backstageClient.request(url);
      return response.items || [];
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      return [];
    }
  }

  /**
   * Get a specific template
   */
  async getTemplate(name: string): Promise<SoftwareTemplate | null> {
    try {
      const response = await backstageClient.request(`/api/scaffolder/v1/templates/${name}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch template:', error);
      return null;
    }
  }

  /**
   * Execute a template
   */
  async executeTemplate(
    templateName: string,
    parameters: Record<string, any>
  ): Promise<TemplateExecution> {
    const response = await fetch('/api/templates/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateName,
        parameters,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to execute template: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<TemplateExecution | null> {
    try {
      const response = await fetch(`/api/templates/executions/${executionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch execution: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Failed to fetch execution:', error);
      return null;
    }
  }

  /**
   * List executions
   */
  async listExecutions(): Promise<TemplateExecution[]> {
    try {
      const response = await fetch('/api/templates/executions');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch executions: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Failed to fetch executions:', error);
      return [];
    }
  }

  /**
   * Cancel an execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/templates/executions/${executionId}/cancel`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel execution: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      return false;
    }
  }

  /**
   * Validate template parameters
   */
  async validateParameters(
    templateName: string,
    parameters: Record<string, any>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const response = await fetch('/api/templates/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateName,
          parameters,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to validate parameters: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Failed to validate parameters:', error);
      return { valid: false, errors: ['Validation failed'] };
    }
  }

  /**
   * Get template parameter schema
   */
  async getParameterSchema(templateName: string): Promise<any> {
    try {
      const template = await this.getTemplate(templateName);
      return template?.spec.parameters || null;
    } catch (error) {
      console.error('Failed to fetch parameter schema:', error);
      return null;
    }
  }
}

// Create and export singleton instance
export const templateClient = new TemplateClient();