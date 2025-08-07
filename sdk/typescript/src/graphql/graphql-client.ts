import { GraphQLClient, gql } from 'graphql-request';
import { EventEmitter } from 'eventemitter3';

import { AuthManager } from '../auth/auth-manager';
import { GraphQLResponse, GraphQLRequest, RequestOptions } from '../types';

export interface GraphQLClientConfig {
  endpoint: string;
  wsEndpoint?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface GraphQLSubscriptionOptions {
  onData?: (data: any) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class BackstageGraphQLClient extends EventEmitter {
  private client: GraphQLClient;
  private authManager: AuthManager;
  private subscriptions: Map<string, WebSocket> = new Map();
  private config: GraphQLClientConfig;

  constructor(config: GraphQLClientConfig, authManager: AuthManager) {
    super();
    this.config = config;
    this.authManager = authManager;

    this.client = new GraphQLClient(config.endpoint, {
      headers: config.headers,
      timeout: config.timeout || 30000,
    });

    // Update headers when auth changes
    this.authManager.on('tokensUpdated', () => {
      this.updateHeaders();
    });
  }

  /**
   * Update request headers with current auth
   */
  private updateHeaders(): void {
    const authHeader = this.authManager.getAuthHeader();
    const headers: Record<string, string> = {
      ...this.config.headers,
    };

    if (authHeader) {
      if (authHeader.startsWith('Bearer')) {
        headers['Authorization'] = authHeader;
      } else {
        headers['X-API-Key'] = authHeader;
      }
    }

    this.client.setHeaders(headers);
  }

  /**
   * Execute a GraphQL query
   */
  public async query<T = any>(
    query: string,
    variables?: Record<string, any>,
    options?: RequestOptions
  ): Promise<T> {
    this.updateHeaders();

    try {
      const result = await this.client.request<T>(query, variables, {
        ...options?.headers,
        'X-Request-ID': this.generateRequestId(),
      });

      this.emit('querySuccess', { query, variables, result });
      return result;
    } catch (error) {
      this.emit('queryError', { query, variables, error });
      throw this.transformError(error);
    }
  }

  /**
   * Execute a GraphQL mutation
   */
  public async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>,
    options?: RequestOptions
  ): Promise<T> {
    return this.query<T>(mutation, variables, options);
  }

  /**
   * Subscribe to GraphQL subscription via WebSocket
   */
  public subscribe(
    subscription: string,
    variables?: Record<string, any>,
    options?: GraphQLSubscriptionOptions
  ): () => void {
    if (!this.config.wsEndpoint) {
      throw new Error('WebSocket endpoint not configured for subscriptions');
    }

    const subscriptionId = this.generateSubscriptionId();
    const ws = new WebSocket(this.config.wsEndpoint, 'graphql-ws');
    
    ws.onopen = () => {
      // Send connection init
      ws.send(JSON.stringify({
        type: 'connection_init',
        payload: this.getAuthPayload(),
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connection_ack':
          // Start subscription
          ws.send(JSON.stringify({
            id: subscriptionId,
            type: 'start',
            payload: {
              query: subscription,
              variables,
            },
          }));
          break;
        
        case 'data':
          if (message.id === subscriptionId && options?.onData) {
            options.onData(message.payload);
          }
          break;
        
        case 'error':
          if (message.id === subscriptionId && options?.onError) {
            options.onError(new Error(message.payload.message));
          }
          break;
        
        case 'complete':
          if (message.id === subscriptionId) {
            if (options?.onComplete) {
              options.onComplete();
            }
            this.subscriptions.delete(subscriptionId);
          }
          break;
      }
    };

    ws.onerror = (error) => {
      if (options?.onError) {
        options.onError(new Error('WebSocket error'));
      }
    };

    this.subscriptions.set(subscriptionId, ws);

    // Return unsubscribe function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          id: subscriptionId,
          type: 'stop',
        }));
      }
      ws.close();
      this.subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Pre-defined queries for common operations
   */
  public queries = {
    // Plugin queries
    getPlugins: gql`
      query GetPlugins($search: String, $category: String, $limit: Int, $offset: Int) {
        plugins(search: $search, category: $category, limit: $limit, offset: $offset) {
          items {
            id
            name
            version
            description
            author
            category
            status
            dependencies
            config
            metadata
            installDate
          }
          total
          hasMore
        }
      }
    `,

    getPlugin: gql`
      query GetPlugin($id: ID!) {
        plugin(id: $id) {
          id
          name
          version
          description
          author
          category
          status
          dependencies
          config
          metadata
          installDate
        }
      }
    `,

    // Workflow queries
    getWorkflows: gql`
      query GetWorkflows($status: WorkflowStatus, $limit: Int) {
        workflows(status: $status, limit: $limit) {
          items {
            id
            name
            description
            status
            config
            steps {
              id
              name
              type
              status
              config
              output
            }
            createdAt
            updatedAt
            completedAt
          }
          total
        }
      }
    `,

    getWorkflow: gql`
      query GetWorkflow($id: ID!) {
        workflow(id: $id) {
          id
          name
          description
          status
          config
          steps {
            id
            name
            type
            status
            config
            output
          }
          createdAt
          updatedAt
          completedAt
        }
      }
    `,

    // Tenant queries
    getCurrentTenant: gql`
      query GetCurrentTenant {
        currentTenant {
          tenant {
            id
            name
            domain
            status
            settings
            createdAt
            updatedAt
          }
          userRole
          isOwner
        }
      }
    `,

    getTenantAnalytics: gql`
      query GetTenantAnalytics($days: Int) {
        tenantAnalytics(days: $days) {
          userCount
          pluginCount
          workflowCount
          apiRequests
          storageUsed
          period
        }
      }
    `,

    // System queries
    getSystemHealth: gql`
      query GetSystemHealth($verbose: Boolean) {
        systemHealth(verbose: $verbose) {
          status
          timestamp
          version
          uptime
          services {
            database {
              status
              message
              responseTime
              details
            }
            backstage {
              status
              message
              responseTime
              details
            }
            cache {
              status
              message
              responseTime
              details
            }
            memory {
              status
              message
              responseTime
              details
            }
          }
          environment
        }
      }
    `,

    getMetrics: gql`
      query GetMetrics($timerange: String) {
        metrics(timerange: $timerange) {
          timestamp
          timerange
          data {
            system {
              cpu
              memory
              disk
              uptime
            }
            performance {
              averageResponseTime
              requestsPerSecond
              errorRate
            }
            usage {
              activeUsers
              apiCalls
              pluginsInstalled
              workflowsExecuted
            }
          }
        }
      }
    `,

    // Search queries
    search: gql`
      query Search($query: String!, $type: String, $limit: Int) {
        search(query: $query, type: $type, limit: $limit) {
          results {
            id
            title
            description
            type
            url
            score
            metadata
          }
          total
          query
          took
        }
      }
    `,
  };

  /**
   * Pre-defined mutations
   */
  public mutations = {
    // Plugin mutations
    installPlugin: gql`
      mutation InstallPlugin($pluginId: String!, $version: String, $config: JSON) {
        installPlugin(pluginId: $pluginId, version: $version, config: $config) {
          success
          pluginId
          installationId
          status
        }
      }
    `,

    uninstallPlugin: gql`
      mutation UninstallPlugin($pluginId: String!) {
        uninstallPlugin(pluginId: $pluginId) {
          success
        }
      }
    `,

    // Workflow mutations
    createWorkflow: gql`
      mutation CreateWorkflow($name: String!, $description: String, $steps: [WorkflowStepInput!]!, $config: JSON) {
        createWorkflow(name: $name, description: $description, steps: $steps, config: $config) {
          id
          name
          description
          status
          config
          steps {
            id
            name
            type
            status
            config
            output
          }
          createdAt
        }
      }
    `,

    updateWorkflow: gql`
      mutation UpdateWorkflow($id: ID!, $name: String, $description: String, $steps: [WorkflowStepInput!], $config: JSON) {
        updateWorkflow(id: $id, name: $name, description: $description, steps: $steps, config: $config) {
          id
          name
          description
          status
          config
          steps {
            id
            name
            type
            status
            config
            output
          }
          updatedAt
        }
      }
    `,

    executeWorkflow: gql`
      mutation ExecuteWorkflow($id: ID!, $parameters: JSON) {
        executeWorkflow(id: $id, parameters: $parameters) {
          executionId
          workflowId
          status
          startedAt
          result
        }
      }
    `,

    // Tenant mutations
    createTenant: gql`
      mutation CreateTenant($name: String!, $domain: String!, $settings: JSON) {
        createTenant(name: $name, domain: $domain, settings: $settings) {
          id
          name
          domain
          status
          settings
          createdAt
        }
      }
    `,

    // Notification mutations
    createNotification: gql`
      mutation CreateNotification($title: String!, $message: String!, $type: NotificationType!, $recipientId: String, $metadata: JSON) {
        createNotification(title: $title, message: $message, type: $type, recipientId: $recipientId, metadata: $metadata) {
          id
          title
          message
          type
          read
          createdAt
          metadata
        }
      }
    `,
  };

  /**
   * Pre-defined subscriptions
   */
  public subscriptions = {
    // Plugin events
    pluginEvents: gql`
      subscription PluginEvents {
        pluginEvent {
          type
          plugin {
            id
            name
            version
            status
          }
          timestamp
        }
      }
    `,

    // Workflow events
    workflowEvents: gql`
      subscription WorkflowEvents {
        workflowEvent {
          type
          workflow {
            id
            name
            status
          }
          execution {
            executionId
            status
            startedAt
            completedAt
          }
          timestamp
        }
      }
    `,

    // System events
    systemEvents: gql`
      subscription SystemEvents {
        systemEvent {
          type
          service
          status
          message
          timestamp
        }
      }
    `,

    // Notification events
    notifications: gql`
      subscription Notifications {
        notification {
          id
          title
          message
          type
          read
          createdAt
          metadata
        }
      }
    `,
  };

  /**
   * Get auth payload for WebSocket connection
   */
  private getAuthPayload(): Record<string, any> {
    const authHeader = this.authManager.getAuthHeader();
    if (authHeader) {
      if (authHeader.startsWith('Bearer')) {
        return { Authorization: authHeader };
      } else {
        return { 'X-API-Key': authHeader };
      }
    }
    return {};
  }

  /**
   * Transform GraphQL error
   */
  private transformError(error: any): Error {
    if (error.response?.errors) {
      const messages = error.response.errors.map((e: any) => e.message).join(', ');
      return new Error(`GraphQL Error: ${messages}`);
    }
    return error;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `gql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close all subscriptions
   */
  public closeAllSubscriptions(): void {
    for (const [id, ws] of this.subscriptions) {
      ws.close();
      this.subscriptions.delete(id);
    }
  }

  /**
   * Dispose of the client
   */
  public dispose(): void {
    this.closeAllSubscriptions();
    this.removeAllListeners();
  }
}