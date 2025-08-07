/**
 * GraphQL Monitoring and Performance Tracking
 */

import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLContext } from '../types';

export function MonitoringPlugin(): ApolloServerPlugin<GraphQLContext> {
  const metrics = new GraphQLMetrics();
  
  return {
    async requestDidStart() {
      const requestStartTime = Date.now();
      
      return {
        async didResolveOperation(requestContext) {
          const { request, operationName } = requestContext;
          
          metrics.recordOperation({
            name: operationName || 'anonymous',
            type: request.query?.includes('mutation') ? 'mutation' : 
                  request.query?.includes('subscription') ? 'subscription' : 'query',
          });
        },
        
        async willSendResponse(requestContext) {
          const duration = Date.now() - requestStartTime;
          const { response, contextValue, operationName } = requestContext;
          
          // Record metrics
          metrics.recordRequest({
            operationName: operationName || 'anonymous',
            duration,
            errors: response.body?.singleResult?.errors?.length || 0,
            userId: contextValue?.user?.id,
          });
          
          // Add performance headers
          if (response.http) {
            response.http.headers.set('X-Response-Time', `${duration}ms`);
            response.http.headers.set('X-Operation-Name', operationName || 'anonymous');
            
            if (contextValue?.queryMetrics) {
              response.http.headers.set(
                'X-Query-Complexity',
                String(contextValue.queryMetrics.complexity || 0)
              );
              response.http.headers.set(
                'X-Query-Depth',
                String(contextValue.queryMetrics.depth || 0)
              );
            }
          }
          
          // Log slow queries
          if (duration > 1000) {
            console.warn(`Slow GraphQL query detected:`, {
              operationName,
              duration: `${duration}ms`,
              userId: contextValue?.user?.id,
            });
          }
        },
        
        async didEncounterErrors(requestContext) {
          const { errors, operationName } = requestContext;
          
          errors.forEach(error => {
            metrics.recordError({
              operationName: operationName || 'anonymous',
              error: error.message,
              path: error.path?.join('.'),
              code: error.extensions?.code,
            });
            
            console.error('GraphQL Error:', {
              operation: operationName,
              message: error.message,
              path: error.path,
              extensions: error.extensions,
            });
          });
        },
      };
    },
  };
}

export class GraphQLMetrics {
  private operations = new Map<string, OperationMetrics>();
  private errors = new Map<string, ErrorMetrics>();
  private requests: RequestMetrics[] = [];
  private startTime = Date.now();
  
  recordOperation(operation: { name: string; type: string }) {
    const key = `${operation.type}:${operation.name}`;
    const metrics = this.operations.get(key) || {
      count: 0,
      type: operation.type,
      name: operation.name,
    };
    
    metrics.count++;
    this.operations.set(key, metrics);
  }
  
  recordRequest(request: RequestMetrics) {
    this.requests.push(request);
    
    // Keep only last 1000 requests
    if (this.requests.length > 1000) {
      this.requests.shift();
    }
  }
  
  recordError(error: ErrorMetrics) {
    const key = error.code || 'UNKNOWN';
    const metrics = this.errors.get(key) || {
      code: key,
      count: 0,
      messages: new Set(),
    };
    
    metrics.count++;
    metrics.messages.add(error.error);
    this.errors.set(key, metrics);
  }
  
  getStats() {
    const uptime = Date.now() - this.startTime;
    const totalRequests = this.requests.length;
    const avgDuration = totalRequests > 0
      ? this.requests.reduce((sum, r) => sum + r.duration, 0) / totalRequests
      : 0;
    
    const errorRate = totalRequests > 0
      ? this.requests.filter(r => r.errors > 0).length / totalRequests
      : 0;
    
    return {
      uptime,
      totalRequests,
      avgDuration,
      errorRate,
      operations: Array.from(this.operations.values()),
      errors: Array.from(this.errors.values()).map(e => ({
        ...e,
        messages: Array.from(e.messages),
      })),
      recentRequests: this.requests.slice(-10),
    };
  }
  
  reset() {
    this.operations.clear();
    this.errors.clear();
    this.requests = [];
    this.startTime = Date.now();
  }
}

interface OperationMetrics {
  name: string;
  type: string;
  count: number;
}

interface RequestMetrics {
  operationName: string;
  duration: number;
  errors: number;
  userId?: string;
}

interface ErrorMetrics {
  operationName: string;
  error: string;
  path?: string;
  code?: string;
}

// Decorator for tracking resolver metrics
export function trackMetrics() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const context = args.find(arg => arg.requestId) as GraphQLContext;
      
      try {
        const result = await originalMethod.apply(this, args);
        
        const duration = Date.now() - startTime;
        
        // Log metrics
        if (context) {
          console.log(`Resolver ${target.constructor.name}.${propertyKey}:`, {
            duration: `${duration}ms`,
            userId: context.user?.id,
            requestId: context.requestId,
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        console.error(`Resolver error in ${target.constructor.name}.${propertyKey}:`, {
          error: error.message,
          duration: `${duration}ms`,
          userId: context?.user?.id,
          requestId: context?.requestId,
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Performance monitoring for production
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  
  startTimer(operation: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration);
    };
  }
  
  recordMetric(operation: string, duration: number) {
    const metric = this.metrics.get(operation) || {
      operation,
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
    };
    
    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    
    this.metrics.set(operation, metric);
  }
  
  getMetrics() {
    return Array.from(this.metrics.values()).map(metric => ({
      ...metric,
      avgDuration: metric.totalDuration / metric.count,
    }));
  }
  
  reset() {
    this.metrics.clear();
  }
}

interface PerformanceMetric {
  operation: string;
  count: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
}