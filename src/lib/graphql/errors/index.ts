/**
 * GraphQL Error Handling and Custom Errors
 */

import { GraphQLError } from 'graphql';
import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLContext } from '../types';

// Custom Error Classes
export class AuthenticationError extends GraphQLError {
  constructor(message: string = 'Authentication required') {
    super(message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }
}

export class AuthorizationError extends GraphQLError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }
}

export class ValidationError extends GraphQLError {
  constructor(message: string, field?: string) {
    super(message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        field,
        http: { status: 400 },
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    
    super(message, {
      extensions: {
        code: 'NOT_FOUND',
        resource,
        id,
        http: { status: 404 },
      },
    });
  }
}

export class RateLimitError extends GraphQLError {
  constructor(limit: number, resetAt: Date) {
    super(`Rate limit exceeded. Limit: ${limit} requests`, {
      extensions: {
        code: 'RATE_LIMITED',
        limit,
        resetAt: resetAt.toISOString(),
        http: { status: 429 },
      },
    });
  }
}

export class ConflictError extends GraphQLError {
  constructor(message: string, conflictingField?: string) {
    super(message, {
      extensions: {
        code: 'CONFLICT',
        conflictingField,
        http: { status: 409 },
      },
    });
  }
}

export class InternalServerError extends GraphQLError {
  constructor(message: string = 'Internal server error', originalError?: Error) {
    super(message, {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        originalError: originalError?.message,
        http: { status: 500 },
      },
    });
  }
}

export class ServiceUnavailableError extends GraphQLError {
  constructor(service: string) {
    super(`Service ${service} is currently unavailable`, {
      extensions: {
        code: 'SERVICE_UNAVAILABLE',
        service,
        http: { status: 503 },
      },
    });
  }
}

// Error Handling Plugin
export function ErrorHandlingPlugin(): ApolloServerPlugin<GraphQLContext> {
  return {
    async requestDidStart() {
      return {
        async didEncounterErrors(requestContext) {
          const { errors, contextValue } = requestContext;
          
          for (const error of errors) {
            // Log error with context
            logError(error, contextValue);
            
            // Transform error for client
            transformError(error);
          }
        },
      };
    },
  };
}

// Error logging
function logError(error: GraphQLError, context?: GraphQLContext) {
  const errorLog = {
    message: error.message,
    code: error.extensions?.code,
    path: error.path,
    timestamp: new Date().toISOString(),
    requestId: context?.requestId,
    userId: context?.user?.id,
    operation: error.source?.body,
    stack: error.stack,
  };
  
  // Log based on severity
  if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
    console.error('Critical Error:', errorLog);
    // Send to error tracking service (e.g., Sentry)
  } else if (error.extensions?.code === 'UNAUTHENTICATED' || 
             error.extensions?.code === 'FORBIDDEN') {
    console.warn('Auth Error:', errorLog);
  } else {
    console.log('GraphQL Error:', errorLog);
  }
}

// Error transformation
function transformError(error: GraphQLError) {
  // Hide internal error details in production
  if (process.env.NODE_ENV === 'production') {
    if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      error.message = 'An error occurred while processing your request';
      delete error.extensions.originalError;
      delete error.extensions.stacktrace;
    }
  }
  
  // Add request correlation ID
  if (!error.extensions?.requestId) {
    error.extensions = {
      ...error.extensions,
      timestamp: new Date().toISOString(),
    };
  }
}

// Error formatter
export function formatError(error: GraphQLError) {
  return {
    message: error.message,
    code: error.extensions?.code || 'UNKNOWN_ERROR',
    path: error.path,
    locations: error.locations,
    extensions: {
      ...error.extensions,
      timestamp: new Date().toISOString(),
    },
  };
}

// Validation helpers
export function validateInput(schema: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Validate input against schema
      const input = args[0];
      
      try {
        // Implement validation logic
        const errors = validateAgainstSchema(input, schema);
        
        if (errors.length > 0) {
          throw new ValidationError(
            `Validation failed: ${errors.join(', ')}`,
            errors[0]
          );
        }
        
        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new InternalServerError('Validation error', error);
      }
    };
    
    return descriptor;
  };
}

function validateAgainstSchema(input: any, schema: any): string[] {
  const errors: string[] = [];
  
  // Implement schema validation
  // This is a placeholder - use a proper validation library
  
  return errors;
}

// Error recovery strategies
export class ErrorRecovery {
  private retryDelays = [1000, 2000, 5000, 10000]; // Exponential backoff
  
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors
        if (error instanceof ValidationError ||
            error instanceof AuthenticationError ||
            error instanceof AuthorizationError ||
            error instanceof NotFoundError) {
          throw error;
        }
        
        // Wait before retry
        if (i < maxRetries - 1) {
          const delay = this.retryDelays[i] || 10000;
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError!;
  }
  
  async withFallback<T>(
    operation: () => Promise<T>,
    fallback: () => T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error('Operation failed, using fallback:', error);
      return fallback();
    }
  }
  
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}