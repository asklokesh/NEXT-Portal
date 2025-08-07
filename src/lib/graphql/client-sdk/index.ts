/**
 * GraphQL Client SDK with Code Generation
 */

import { GraphQLClient } from 'graphql-request';
import { print } from 'graphql';
import { DocumentNode } from 'graphql';

export class PortalGraphQLClient {
  private client: GraphQLClient;
  private subscriptionClient: any;
  
  constructor(
    endpoint: string,
    options?: {
      headers?: Record<string, string>;
      timeout?: number;
      retries?: number;
    }
  ) {
    this.client = new GraphQLClient(endpoint, {
      headers: options?.headers || {},
      timeout: options?.timeout || 30000,
      errorPolicy: 'all',
    });
  }
  
  // Authentication
  setAuthToken(token: string) {
    this.client.setHeader('authorization', `Bearer ${token}`);
  }
  
  // Request ID for tracing
  setRequestId(requestId: string) {
    this.client.setHeader('x-request-id', requestId);
  }
  
  // Service Queries
  async getService(id: string) {
    const query = `
      query GetService($id: ID!) {
        service(id: $id) {
          id
          name
          description
          type
          status
          owner {
            id
            name
            email
          }
          tags
          metadata {
            repository
            documentation
            apiSpec
            environments
          }
          health {
            state
            message
            lastChecked
            checks {
              name
              status
              message
              responseTime
            }
          }
          createdAt
          updatedAt
        }
      }
    `;
    
    return this.client.request(query, { id });
  }
  
  async listServices(options?: {
    first?: number;
    after?: string;
    filter?: any;
    sort?: any;
  }) {
    const query = `
      query ListServices(
        $first: Int
        $after: String
        $filter: ServiceFilter
        $sort: ServiceSort
      ) {
        services(
          first: $first
          after: $after
          filter: $filter
          sort: $sort
        ) {
          edges {
            node {
              id
              name
              description
              type
              status
              tags
              owner {
                id
                name
              }
              health {
                state
              }
              updatedAt
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `;
    
    return this.client.request(query, options);
  }
  
  async createService(input: any) {
    const mutation = `
      mutation CreateService($input: CreateServiceInput!) {
        createService(input: $input) {
          id
          name
          description
          type
          status
        }
      }
    `;
    
    return this.client.request(mutation, { input });
  }
  
  async updateService(id: string, input: any) {
    const mutation = `
      mutation UpdateService($id: ID!, $input: UpdateServiceInput!) {
        updateService(id: $id, input: $input) {
          id
          name
          description
          status
          updatedAt
        }
      }
    `;
    
    return this.client.request(mutation, { id, input });
  }
  
  // Plugin Queries
  async getPlugin(id: string) {
    const query = `
      query GetPlugin($id: ID!) {
        plugin(id: $id) {
          id
          name
          description
          version
          author
          category
          status
          icon
          documentation
          repository
          dependencies {
            name
            version
            required
          }
          configuration {
            schema
            defaults
            required
          }
          metrics {
            downloads
            activeInstalls
            avgLoadTime
            errorRate
            satisfaction
          }
          installedCount
          rating
          createdAt
          updatedAt
        }
      }
    `;
    
    return this.client.request(query, { id });
  }
  
  async listPlugins(options?: {
    first?: number;
    after?: string;
    category?: string;
    search?: string;
  }) {
    const query = `
      query ListPlugins(
        $first: Int
        $after: String
        $category: PluginCategory
        $search: String
      ) {
        plugins(
          first: $first
          after: $after
          category: $category
          search: $search
        ) {
          edges {
            node {
              id
              name
              description
              version
              author
              category
              status
              icon
              installedCount
              rating
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `;
    
    return this.client.request(query, options);
  }
  
  async installPlugin(id: string, configuration?: any) {
    const mutation = `
      mutation InstallPlugin($id: ID!, $configuration: JSON) {
        installPlugin(id: $id, configuration: $configuration) {
          id
          name
          status
        }
      }
    `;
    
    return this.client.request(mutation, { id, configuration });
  }
  
  // Template Queries
  async getTemplate(id: string) {
    const query = `
      query GetTemplate($id: ID!) {
        template(id: $id) {
          id
          name
          description
          category
          tags
          parameters {
            name
            type
            description
            default
            required
            validation
          }
          steps {
            id
            name
            action
            parameters
            condition
          }
          owner {
            id
            name
          }
          visibility
          usageCount
          rating
          createdAt
          updatedAt
        }
      }
    `;
    
    return this.client.request(query, { id });
  }
  
  async executeTemplate(id: string, parameters: any) {
    const mutation = `
      mutation ExecuteTemplate($id: ID!, $parameters: JSON!) {
        executeTemplate(id: $id, parameters: $parameters) {
          id
          template {
            id
            name
          }
          status
          progress
          logs
          result
          createdAt
        }
      }
    `;
    
    return this.client.request(mutation, { id, parameters });
  }
  
  // Cost Queries
  async getCostReport(period: string) {
    const query = `
      query GetCostReport($period: String!) {
        costReport(period: $period) {
          totalCost
          projectedCost
          services {
            service {
              id
              name
            }
            currentCost
            projectedCost
            breakdown
          }
          trends {
            date
            cost
          }
          recommendations {
            title
            description
            potentialSavings
            priority
          }
        }
      }
    `;
    
    return this.client.request(query, { period });
  }
  
  // Metrics Queries
  async getMetrics(
    serviceId: string,
    metricNames: string[],
    from: Date,
    to: Date
  ) {
    const query = `
      query GetMetrics(
        $serviceId: ID!
        $metricNames: [String!]!
        $from: Date!
        $to: Date!
      ) {
        metrics(
          serviceId: $serviceId
          metricNames: $metricNames
          from: $from
          to: $to
        ) {
          label
          data {
            timestamp
            value
          }
        }
      }
    `;
    
    return this.client.request(query, {
      serviceId,
      metricNames,
      from,
      to,
    });
  }
  
  // Subscription Support
  subscribeToServiceUpdates(
    serviceId: string,
    onUpdate: (service: any) => void
  ) {
    // Implement WebSocket subscription
    const subscription = `
      subscription ServiceUpdated($id: ID) {
        serviceUpdated(id: $id) {
          id
          name
          status
          health {
            state
          }
          updatedAt
        }
      }
    `;
    
    // This would connect to WebSocket endpoint
    console.log('Subscribing to service updates:', serviceId);
    return () => {
      // Cleanup subscription
      console.log('Unsubscribing from service updates');
    };
  }
  
  // Batch Operations
  async batchRequest(operations: Array<{ query: string; variables?: any }>) {
    const results = await Promise.all(
      operations.map(op => this.client.request(op.query, op.variables))
    );
    return results;
  }
  
  // Error Handling
  handleError(error: any) {
    if (error.response?.errors) {
      const graphQLErrors = error.response.errors;
      console.error('GraphQL Errors:', graphQLErrors);
      throw new GraphQLClientError(graphQLErrors);
    }
    throw error;
  }
}

// Custom Error Class
export class GraphQLClientError extends Error {
  public errors: any[];
  
  constructor(errors: any[]) {
    super(errors[0]?.message || 'GraphQL Error');
    this.errors = errors;
    this.name = 'GraphQLClientError';
  }
}

// Type-safe SDK Factory
export function createPortalSDK(config: {
  endpoint: string;
  token?: string;
  headers?: Record<string, string>;
}) {
  const client = new PortalGraphQLClient(config.endpoint, {
    headers: {
      ...config.headers,
      ...(config.token && { authorization: `Bearer ${config.token}` }),
    },
  });
  
  return client;
}

// React Hook for GraphQL Client
export function usePortalGraphQL() {
  const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || '/api/graphql';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const client = new PortalGraphQLClient(endpoint, {
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
    },
  });
  
  return client;
}