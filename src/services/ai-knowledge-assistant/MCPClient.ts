/**
 * MCP (Model Context Protocol) Client
 * Manages connections to MCP servers for extended AI capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MCPServer,
  MCPCapability,
  MCPToolRequest,
  MCPToolResponse,
} from './types';

interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
  capabilities?: string[];
}

export class MCPClient {
  private servers: Map<string, MCPServer> = new Map();
  private capabilities: Map<string, { serverId: string; capability: MCPCapability }> = new Map();

  async initialize(): Promise<void> {
    // Register built-in MCP servers
    await this.registerBuiltInServers();
    console.log(`MCP Client initialized with ${this.servers.size} servers`);
  }

  /**
   * Register an MCP server
   */
  async registerServer(config: MCPServerConfig): Promise<MCPServer> {
    const server: MCPServer = {
      id: config.id,
      name: config.name,
      description: config.description,
      type: 'custom',
      endpoint: config.endpoint,
      capabilities: [],
      status: 'inactive',
      config: {
        apiKey: config.apiKey,
        headers: config.headers,
      },
    };

    try {
      // Discover capabilities from server
      server.capabilities = await this.discoverCapabilities(server);
      server.status = 'active';

      // Index capabilities
      for (const capability of server.capabilities) {
        this.capabilities.set(
          `${server.id}:${capability.name}`,
          { serverId: server.id, capability }
        );
      }
    } catch (error) {
      console.error(`Failed to register MCP server ${config.name}:`, error);
      server.status = 'error';
    }

    this.servers.set(server.id, server);
    return server;
  }

  /**
   * Unregister an MCP server
   */
  async unregisterServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    // Remove capabilities
    for (const capability of server.capabilities) {
      this.capabilities.delete(`${serverId}:${capability.name}`);
    }

    this.servers.delete(serverId);
    return true;
  }

  /**
   * List all registered servers
   */
  listServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by ID
   */
  getServer(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * List all available capabilities
   */
  listCapabilities(type?: MCPCapability['type']): Array<{ serverId: string; capability: MCPCapability }> {
    const caps = Array.from(this.capabilities.values());
    if (type) {
      return caps.filter(c => c.capability.type === type);
    }
    return caps;
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    const server = this.servers.get(request.serverId);
    if (!server) {
      return {
        success: false,
        error: `Server not found: ${request.serverId}`,
        metadata: {
          executionTime: 0,
          serverId: request.serverId,
          toolName: request.toolName,
        },
      };
    }

    if (server.status !== 'active') {
      return {
        success: false,
        error: `Server is not active: ${server.status}`,
        metadata: {
          executionTime: 0,
          serverId: request.serverId,
          toolName: request.toolName,
        },
      };
    }

    const startTime = Date.now();

    try {
      const response = await this.callServer(server, 'tools/call', {
        name: request.toolName,
        arguments: request.parameters,
        context: request.context,
      });

      return {
        success: true,
        data: response.result,
        metadata: {
          executionTime: Date.now() - startTime,
          serverId: request.serverId,
          toolName: request.toolName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        metadata: {
          executionTime: Date.now() - startTime,
          serverId: request.serverId,
          toolName: request.toolName,
        },
      };
    }
  }

  /**
   * Get a resource from an MCP server
   */
  async getResource(
    serverId: string,
    resourceUri: string
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'active') {
      return { success: false, error: 'Server not available' };
    }

    try {
      const response = await this.callServer(server, 'resources/read', {
        uri: resourceUri,
      });
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute a prompt template from an MCP server
   */
  async executePrompt(
    serverId: string,
    promptName: string,
    arguments_: Record<string, unknown>
  ): Promise<{ success: boolean; messages?: unknown[]; error?: string }> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'active') {
      return { success: false, error: 'Server not available' };
    }

    try {
      const response = await this.callServer(server, 'prompts/get', {
        name: promptName,
        arguments: arguments_,
      });
      return { success: true, messages: response.messages };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Check server health
   */
  async checkServerHealth(serverId: string): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const server = this.servers.get(serverId);
    if (!server) {
      return { healthy: false, error: 'Server not found' };
    }

    const startTime = Date.now();

    try {
      await this.callServer(server, 'ping', {});
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: String(error),
      };
    }
  }

  /**
   * Refresh server capabilities
   */
  async refreshCapabilities(serverId: string): Promise<MCPCapability[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    // Remove old capabilities
    for (const capability of server.capabilities) {
      this.capabilities.delete(`${serverId}:${capability.name}`);
    }

    // Discover new capabilities
    server.capabilities = await this.discoverCapabilities(server);

    // Index new capabilities
    for (const capability of server.capabilities) {
      this.capabilities.set(
        `${serverId}:${capability.name}`,
        { serverId, capability }
      );
    }

    this.servers.set(serverId, server);
    return server.capabilities;
  }

  // Private methods

  private async registerBuiltInServers(): Promise<void> {
    // Portal Actions MCP Server (built-in)
    const portalServer: MCPServer = {
      id: 'portal-actions',
      name: 'Portal Actions',
      description: 'Built-in MCP server for Portal self-service actions',
      type: 'builtin',
      endpoint: 'internal://portal-actions',
      capabilities: [
        {
          name: 'get-catalog-entity',
          type: 'tool',
          description: 'Get an entity from the software catalog',
          schema: {
            type: 'object',
            properties: {
              kind: { type: 'string', description: 'Entity kind' },
              name: { type: 'string', description: 'Entity name' },
              namespace: { type: 'string', description: 'Entity namespace' },
            },
            required: ['kind', 'name'],
          },
        },
        {
          name: 'search-catalog',
          type: 'tool',
          description: 'Search the software catalog',
          schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              kinds: { type: 'array', description: 'Entity kinds to filter' },
            },
            required: ['query'],
          },
        },
        {
          name: 'list-templates',
          type: 'tool',
          description: 'List available software templates',
        },
        {
          name: 'execute-action',
          type: 'tool',
          description: 'Execute a self-service action',
          schema: {
            type: 'object',
            properties: {
              actionId: { type: 'string', description: 'Action ID' },
              entityRef: { type: 'string', description: 'Target entity reference' },
              parameters: { type: 'object', description: 'Action parameters' },
            },
            required: ['actionId'],
          },
        },
      ],
      status: 'active',
    };

    this.servers.set(portalServer.id, portalServer);
    for (const cap of portalServer.capabilities) {
      this.capabilities.set(`${portalServer.id}:${cap.name}`, {
        serverId: portalServer.id,
        capability: cap,
      });
    }

    // Documentation MCP Server (built-in)
    const docsServer: MCPServer = {
      id: 'portal-docs',
      name: 'Portal Documentation',
      description: 'Built-in MCP server for documentation search and retrieval',
      type: 'builtin',
      endpoint: 'internal://portal-docs',
      capabilities: [
        {
          name: 'search-docs',
          type: 'tool',
          description: 'Search documentation',
          schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              scope: { type: 'string', description: 'Documentation scope' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get-doc-content',
          type: 'resource',
          description: 'Get documentation content',
        },
      ],
      status: 'active',
    };

    this.servers.set(docsServer.id, docsServer);
    for (const cap of docsServer.capabilities) {
      this.capabilities.set(`${docsServer.id}:${cap.name}`, {
        serverId: docsServer.id,
        capability: cap,
      });
    }
  }

  private async discoverCapabilities(server: MCPServer): Promise<MCPCapability[]> {
    if (server.type === 'builtin') {
      return server.capabilities;
    }

    try {
      // Call the server's capabilities endpoint
      const response = await this.callServer(server, 'capabilities/list', {});

      const capabilities: MCPCapability[] = [];

      // Tools
      if (response.tools) {
        for (const tool of response.tools) {
          capabilities.push({
            name: tool.name,
            type: 'tool',
            description: tool.description,
            schema: tool.inputSchema,
          });
        }
      }

      // Resources
      if (response.resources) {
        for (const resource of response.resources) {
          capabilities.push({
            name: resource.uri,
            type: 'resource',
            description: resource.description,
          });
        }
      }

      // Prompts
      if (response.prompts) {
        for (const prompt of response.prompts) {
          capabilities.push({
            name: prompt.name,
            type: 'prompt',
            description: prompt.description,
            schema: prompt.arguments,
          });
        }
      }

      return capabilities;
    } catch (error) {
      console.error(`Failed to discover capabilities for ${server.name}:`, error);
      return [];
    }
  }

  private async callServer(
    server: MCPServer,
    method: string,
    params: Record<string, unknown>
  ): Promise<any> {
    if (server.type === 'builtin') {
      // Handle built-in servers internally
      return this.handleBuiltInServerCall(server.id, method, params);
    }

    // Call external MCP server
    const response = await fetch(server.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(server.config?.apiKey ? { Authorization: `Bearer ${server.config.apiKey}` } : {}),
        ...(server.config?.headers || {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: uuidv4(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'MCP server error');
    }

    return result.result;
  }

  private async handleBuiltInServerCall(
    serverId: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<any> {
    // Handle built-in server methods
    switch (serverId) {
      case 'portal-actions':
        return this.handlePortalActionsCall(method, params);
      case 'portal-docs':
        return this.handlePortalDocsCall(method, params);
      default:
        throw new Error(`Unknown built-in server: ${serverId}`);
    }
  }

  private async handlePortalActionsCall(
    method: string,
    params: Record<string, unknown>
  ): Promise<any> {
    switch (method) {
      case 'tools/call':
        const toolName = params.name as string;
        const args = params.arguments as Record<string, unknown>;

        switch (toolName) {
          case 'get-catalog-entity':
            // This would call the actual catalog API
            return {
              result: {
                kind: args.kind,
                name: args.name,
                namespace: args.namespace || 'default',
                // ... entity data
              },
            };
          case 'search-catalog':
            return { result: { items: [] } };
          case 'list-templates':
            return { result: { templates: [] } };
          case 'execute-action':
            return { result: { status: 'pending' } };
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

      case 'ping':
        return { status: 'ok' };

      case 'capabilities/list':
        const server = this.servers.get('portal-actions');
        return {
          tools: server?.capabilities.filter(c => c.type === 'tool').map(c => ({
            name: c.name,
            description: c.description,
            inputSchema: c.schema,
          })),
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async handlePortalDocsCall(
    method: string,
    params: Record<string, unknown>
  ): Promise<any> {
    switch (method) {
      case 'tools/call':
        const toolName = params.name as string;
        const args = params.arguments as Record<string, unknown>;

        switch (toolName) {
          case 'search-docs':
            return { result: { items: [] } };
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

      case 'resources/read':
        return { content: '' };

      case 'ping':
        return { status: 'ok' };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
}

export default MCPClient;
