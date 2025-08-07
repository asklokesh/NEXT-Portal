/**
 * GraphQL Federation for Microservices
 */

import { buildSubgraphSchema } from '@apollo/subgraph';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { GraphQLSchema } from 'graphql';
import { GraphQLContext } from '../types';

export interface ServiceDefinition {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

export interface FederationConfig {
  services: ServiceDefinition[];
  pollIntervalInMs?: number;
  debug?: boolean;
  serviceHealthCheck?: boolean;
}

// Create federated gateway
export async function createFederatedGateway(
  config: FederationConfig
): Promise<ApolloGateway> {
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: config.services.map(service => ({
        name: service.name,
        url: service.url,
      })),
      pollIntervalInMs: config.pollIntervalInMs || 10000,
    }),
    debug: config.debug || false,
    serviceHealthCheck: config.serviceHealthCheck !== false,
    buildService({ name, url }) {
      return new AuthenticatedDataSource({ name, url });
    },
  });

  return gateway;
}

// Custom data source with authentication
class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }: any) {
    // Forward authentication headers
    if (context.req?.headers?.authorization) {
      request.http.headers.set(
        'authorization',
        context.req.headers.authorization
      );
    }
    
    // Forward request ID for tracing
    if (context.requestId) {
      request.http.headers.set('x-request-id', context.requestId);
    }
    
    // Add service mesh headers
    request.http.headers.set('x-forwarded-for', context.req?.ip || '');
    request.http.headers.set('x-service-name', 'api-gateway');
  }
  
  didReceiveResponse({ response, context }: any) {
    // Extract and forward rate limit headers
    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
    ];
    
    rateLimitHeaders.forEach(header => {
      const value = response.http.headers.get(header);
      if (value) {
        context.res?.set(header, value);
      }
    });
    
    return response;
  }
}

// Service Registry for dynamic federation
export class ServiceRegistry {
  private services: Map<string, ServiceDefinition> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  
  registerService(service: ServiceDefinition) {
    this.services.set(service.name, service);
    this.startHealthCheck(service);
  }
  
  unregisterService(name: string) {
    this.services.delete(name);
    this.stopHealthCheck(name);
  }
  
  getServices(): ServiceDefinition[] {
    return Array.from(this.services.values());
  }
  
  getHealthyServices(): ServiceDefinition[] {
    return this.getServices().filter(service => 
      this.isServiceHealthy(service.name)
    );
  }
  
  private startHealthCheck(service: ServiceDefinition) {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${service.url}/health`);
        const isHealthy = response.ok;
        
        this.healthChecks.set(service.name, {
          isHealthy,
          lastCheck: new Date(),
          responseTime: response.headers.get('x-response-time') || '0',
        });
      } catch (error) {
        this.healthChecks.set(service.name, {
          isHealthy: false,
          lastCheck: new Date(),
          error: error.message,
        });
      }
    }, 30000); // Check every 30 seconds
    
    // Store interval for cleanup
    (this.healthChecks.get(service.name) || {} as any).interval = interval;
  }
  
  private stopHealthCheck(name: string) {
    const healthCheck = this.healthChecks.get(name);
    if (healthCheck?.interval) {
      clearInterval(healthCheck.interval);
    }
    this.healthChecks.delete(name);
  }
  
  private isServiceHealthy(name: string): boolean {
    const healthCheck = this.healthChecks.get(name);
    return healthCheck?.isHealthy !== false;
  }
  
  getHealthStatus() {
    const status: Record<string, any> = {};
    
    this.services.forEach((service, name) => {
      const healthCheck = this.healthChecks.get(name);
      status[name] = {
        url: service.url,
        ...healthCheck,
      };
    });
    
    return status;
  }
}

interface HealthCheck {
  isHealthy: boolean;
  lastCheck: Date;
  responseTime?: string;
  error?: string;
  interval?: NodeJS.Timeout;
}

// Federation directives for subgraphs
export const federationDirectives = `
  directive @key(fields: String!) on OBJECT | INTERFACE
  directive @extends on OBJECT | INTERFACE
  directive @external on FIELD_DEFINITION
  directive @requires(fields: String!) on FIELD_DEFINITION
  directive @provides(fields: String!) on FIELD_DEFINITION
  directive @shareable on OBJECT | FIELD_DEFINITION
`;

// Create subgraph schema
export function createSubgraphSchema(
  typeDefs: string,
  resolvers: any
): GraphQLSchema {
  return buildSubgraphSchema([
    {
      typeDefs: `
        ${federationDirectives}
        ${typeDefs}
      `,
      resolvers,
    },
  ]);
}

// Entity resolver helpers
export function createEntityResolver<T>(
  typeName: string,
  loader: (id: string) => Promise<T>
) {
  return {
    [typeName]: {
      __resolveReference: async (
        reference: { id: string },
        context: GraphQLContext
      ) => {
        return loader(reference.id);
      },
    },
  };
}

// Distributed tracing
export class DistributedTracer {
  private traces: Map<string, Trace> = new Map();
  
  startTrace(requestId: string, operation: string) {
    this.traces.set(requestId, {
      id: requestId,
      operation,
      startTime: Date.now(),
      spans: [],
    });
  }
  
  addSpan(
    requestId: string,
    service: string,
    operation: string,
    duration: number
  ) {
    const trace = this.traces.get(requestId);
    if (trace) {
      trace.spans.push({
        service,
        operation,
        duration,
        timestamp: Date.now(),
      });
    }
  }
  
  endTrace(requestId: string) {
    const trace = this.traces.get(requestId);
    if (trace) {
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
      
      // Send to monitoring service
      this.sendToMonitoring(trace);
      
      // Clean up old traces
      if (this.traces.size > 1000) {
        const oldestKey = this.traces.keys().next().value;
        this.traces.delete(oldestKey);
      }
    }
  }
  
  private sendToMonitoring(trace: Trace) {
    // Send trace data to monitoring service
    console.log('Trace completed:', {
      id: trace.id,
      operation: trace.operation,
      duration: trace.duration,
      spanCount: trace.spans.length,
    });
  }
  
  getTrace(requestId: string): Trace | undefined {
    return this.traces.get(requestId);
  }
}

interface Trace {
  id: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  spans: Span[];
}

interface Span {
  service: string;
  operation: string;
  duration: number;
  timestamp: number;
}