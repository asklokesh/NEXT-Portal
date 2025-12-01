/**
 * AI Tool Registry
 * Manages tools that the AI assistant can use to perform actions
 */

import { v4 as uuidv4 } from 'uuid';
import { AITool, AIToolParameter, AIToolResult } from './types';

interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export class AIToolRegistry {
  private tools: Map<string, AITool> = new Map();

  async initialize(): Promise<void> {
    this.registerBuiltInTools();
    console.log(`AI Tool Registry initialized with ${this.tools.size} tools`);
  }

  /**
   * Register a tool
   */
  registerTool(tool: AITool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  listTools(category?: AITool['category']): AITool[] {
    const tools = Array.from(this.tools.values());
    if (category) {
      return tools.filter(t => t.category === category);
    }
    return tools;
  }

  /**
   * Get tool schemas for LLM function calling
   */
  getToolSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
          };
          return acc;
        }, {} as Record<string, { type: string; description: string; enum?: string[] }>),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    }));
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<AIToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        toolCallId: uuidv4(),
        success: false,
        error: `Tool not found: ${toolName}`,
        executionTime: 0,
      };
    }

    // Validate parameters
    const validationError = this.validateParameters(tool, parameters);
    if (validationError) {
      return {
        toolCallId: uuidv4(),
        success: false,
        error: validationError,
        executionTime: 0,
      };
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(parameters);
      return {
        toolCallId: uuidv4(),
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        toolCallId: uuidv4(),
        success: false,
        error: String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  // Private methods

  private validateParameters(
    tool: AITool,
    parameters: Record<string, unknown>
  ): string | null {
    for (const param of tool.parameters) {
      if (param.required && !(param.name in parameters)) {
        return `Missing required parameter: ${param.name}`;
      }

      if (param.name in parameters) {
        const value = parameters[param.name];
        if (!this.validateType(value, param.type)) {
          return `Invalid type for parameter ${param.name}: expected ${param.type}`;
        }

        if (param.enum && !param.enum.includes(String(value))) {
          return `Invalid value for parameter ${param.name}: must be one of ${param.enum.join(', ')}`;
        }
      }
    }
    return null;
  }

  private validateType(value: unknown, type: AIToolParameter['type']): boolean {
    switch (type) {
      case 'string':
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

  private registerBuiltInTools(): void {
    // Catalog Tools
    this.registerTool({
      name: 'get_service_info',
      description: 'Get detailed information about a service from the software catalog',
      category: 'catalog',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'The name of the service to look up',
          required: true,
        },
        {
          name: 'namespace',
          type: 'string',
          description: 'The namespace of the service (default: default)',
          required: false,
          default: 'default',
        },
      ],
      handler: async (params) => {
        // This would call the catalog API
        return {
          name: params.serviceName,
          owner: 'team-platform',
          lifecycle: 'production',
          description: 'Service information placeholder',
        };
      },
    });

    this.registerTool({
      name: 'search_catalog',
      description: 'Search the software catalog for services, APIs, or components',
      category: 'catalog',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true,
        },
        {
          name: 'kind',
          type: 'string',
          description: 'Entity kind to filter by',
          required: false,
          enum: ['Component', 'API', 'System', 'Domain', 'Resource', 'Group', 'User'],
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results',
          required: false,
          default: 10,
        },
      ],
      handler: async (params) => {
        // This would call the catalog search API
        return { results: [], total: 0, query: params.query };
      },
    });

    this.registerTool({
      name: 'get_service_dependencies',
      description: 'Get the dependencies of a service',
      category: 'catalog',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'The name of the service',
          required: true,
        },
        {
          name: 'direction',
          type: 'string',
          description: 'Dependency direction',
          required: false,
          enum: ['upstream', 'downstream', 'both'],
          default: 'both',
        },
      ],
      handler: async (params) => {
        return { upstream: [], downstream: [], service: params.serviceName };
      },
    });

    this.registerTool({
      name: 'get_team_services',
      description: 'Get all services owned by a team',
      category: 'catalog',
      parameters: [
        {
          name: 'teamName',
          type: 'string',
          description: 'The name of the team',
          required: true,
        },
      ],
      handler: async (params) => {
        return { team: params.teamName, services: [] };
      },
    });

    // Documentation Tools
    this.registerTool({
      name: 'search_documentation',
      description: 'Search technical documentation',
      category: 'documentation',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true,
        },
        {
          name: 'scope',
          type: 'string',
          description: 'Documentation scope',
          required: false,
          enum: ['all', 'service', 'api', 'guides', 'tutorials'],
        },
      ],
      handler: async (params) => {
        return { results: [], query: params.query };
      },
    });

    this.registerTool({
      name: 'get_api_documentation',
      description: 'Get API documentation including endpoints and schemas',
      category: 'documentation',
      parameters: [
        {
          name: 'apiName',
          type: 'string',
          description: 'The name of the API',
          required: true,
        },
      ],
      handler: async (params) => {
        return { api: params.apiName, endpoints: [], schemas: {} };
      },
    });

    // Deployment Tools
    this.registerTool({
      name: 'get_deployment_status',
      description: 'Get the deployment status of a service',
      category: 'deployment',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'The name of the service',
          required: true,
        },
        {
          name: 'environment',
          type: 'string',
          description: 'The environment',
          required: false,
          enum: ['development', 'staging', 'production'],
        },
      ],
      handler: async (params) => {
        return {
          service: params.serviceName,
          environment: params.environment || 'all',
          deployments: [],
        };
      },
    });

    this.registerTool({
      name: 'get_recent_deployments',
      description: 'Get recent deployments for a service or team',
      category: 'deployment',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'The name of the service (optional)',
          required: false,
        },
        {
          name: 'teamName',
          type: 'string',
          description: 'The name of the team (optional)',
          required: false,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Number of deployments to return',
          required: false,
          default: 10,
        },
      ],
      handler: async (params) => {
        return { deployments: [] };
      },
    });

    // Monitoring Tools
    this.registerTool({
      name: 'get_service_health',
      description: 'Get the health status of a service',
      category: 'monitoring',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'The name of the service',
          required: true,
        },
      ],
      handler: async (params) => {
        return {
          service: params.serviceName,
          status: 'healthy',
          uptime: '99.9%',
          lastCheck: new Date().toISOString(),
        };
      },
    });

    this.registerTool({
      name: 'get_service_metrics',
      description: 'Get metrics for a service',
      category: 'monitoring',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'The name of the service',
          required: true,
        },
        {
          name: 'metricType',
          type: 'string',
          description: 'Type of metrics',
          required: false,
          enum: ['latency', 'throughput', 'errors', 'cpu', 'memory'],
        },
        {
          name: 'timeRange',
          type: 'string',
          description: 'Time range for metrics',
          required: false,
          enum: ['1h', '6h', '24h', '7d', '30d'],
          default: '24h',
        },
      ],
      handler: async (params) => {
        return {
          service: params.serviceName,
          metrics: {},
          timeRange: params.timeRange || '24h',
        };
      },
    });

    this.registerTool({
      name: 'get_incidents',
      description: 'Get incidents for a service',
      category: 'monitoring',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'The name of the service (optional)',
          required: false,
        },
        {
          name: 'status',
          type: 'string',
          description: 'Incident status filter',
          required: false,
          enum: ['open', 'resolved', 'all'],
          default: 'all',
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Number of incidents to return',
          required: false,
          default: 10,
        },
      ],
      handler: async (params) => {
        return { incidents: [] };
      },
    });

    // Workflow Tools
    this.registerTool({
      name: 'list_templates',
      description: 'List available software templates',
      category: 'workflow',
      parameters: [
        {
          name: 'category',
          type: 'string',
          description: 'Template category',
          required: false,
          enum: ['service', 'frontend', 'library', 'infrastructure', 'all'],
        },
      ],
      handler: async (params) => {
        return { templates: [] };
      },
    });

    this.registerTool({
      name: 'execute_template',
      description: 'Execute a software template to create a new project',
      category: 'workflow',
      requiresApproval: true,
      riskLevel: 'medium',
      parameters: [
        {
          name: 'templateId',
          type: 'string',
          description: 'The ID of the template to execute',
          required: true,
        },
        {
          name: 'parameters',
          type: 'object',
          description: 'Template parameters',
          required: true,
        },
      ],
      handler: async (params) => {
        return {
          status: 'pending_approval',
          templateId: params.templateId,
          message: 'Template execution requires approval',
        };
      },
    });

    this.registerTool({
      name: 'trigger_action',
      description: 'Trigger a self-service action',
      category: 'workflow',
      requiresApproval: true,
      riskLevel: 'high',
      parameters: [
        {
          name: 'actionId',
          type: 'string',
          description: 'The ID of the action to trigger',
          required: true,
        },
        {
          name: 'target',
          type: 'string',
          description: 'The target entity for the action',
          required: true,
        },
        {
          name: 'parameters',
          type: 'object',
          description: 'Action parameters',
          required: false,
        },
      ],
      handler: async (params) => {
        return {
          status: 'pending_approval',
          actionId: params.actionId,
          message: 'Action requires approval',
        };
      },
    });

    // Integration Tools
    this.registerTool({
      name: 'search_slack',
      description: 'Search Slack messages and channels',
      category: 'integration',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true,
        },
        {
          name: 'channel',
          type: 'string',
          description: 'Channel to search in (optional)',
          required: false,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Number of results to return',
          required: false,
          default: 10,
        },
      ],
      handler: async (params) => {
        return { results: [], query: params.query };
      },
    });

    this.registerTool({
      name: 'search_jira',
      description: 'Search Jira issues',
      category: 'integration',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'JQL query or search text',
          required: true,
        },
        {
          name: 'project',
          type: 'string',
          description: 'Jira project key (optional)',
          required: false,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Number of results to return',
          required: false,
          default: 10,
        },
      ],
      handler: async (params) => {
        return { issues: [], query: params.query };
      },
    });

    this.registerTool({
      name: 'search_github',
      description: 'Search GitHub repositories, code, or issues',
      category: 'integration',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true,
        },
        {
          name: 'type',
          type: 'string',
          description: 'Search type',
          required: false,
          enum: ['repositories', 'code', 'issues', 'pull_requests'],
          default: 'code',
        },
        {
          name: 'org',
          type: 'string',
          description: 'GitHub organization (optional)',
          required: false,
        },
      ],
      handler: async (params) => {
        return { results: [], query: params.query, type: params.type };
      },
    });

    this.registerTool({
      name: 'get_oncall',
      description: 'Get current on-call rotation for a service or team',
      category: 'integration',
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'Service name',
          required: false,
        },
        {
          name: 'teamName',
          type: 'string',
          description: 'Team name',
          required: false,
        },
      ],
      handler: async (params) => {
        return {
          oncall: null,
          schedule: [],
        };
      },
    });
  }
}

export default AIToolRegistry;
