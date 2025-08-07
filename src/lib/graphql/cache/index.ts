/**
 * GraphQL Caching with Automatic Invalidation
 */

import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLContext } from '../types';
import Redis from 'ioredis';
import crypto from 'crypto';

export interface CacheConfig {
  redis: Redis;
  defaultTTL?: number;
  maxCacheSize?: number;
  enableQueryCaching?: boolean;
  enableFieldCaching?: boolean;
}

export class GraphQLCache {
  private redis: Redis;
  private defaultTTL: number;
  private stats = {
    hits: 0,
    misses: 0,
    writes: 0,
    invalidations: 0,
  };
  
  constructor(config: CacheConfig) {
    this.redis = config.redis;
    this.defaultTTL = config.defaultTTL || 300; // 5 minutes
  }
  
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set<T = any>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(
        key,
        ttl || this.defaultTTL,
        serialized
      );
      this.stats.writes++;
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.stats.invalidations += keys.length;
      }
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }
  
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidate(`*:tag:${tag}:*`);
    }
  }
  
  generateKey(
    operation: string,
    variables?: any,
    context?: any
  ): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify({ operation, variables, context }))
      .digest('hex');
    return `gql:${hash}`;
  }
  
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }
  
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      invalidations: 0,
    };
  }
}

// Cache Plugin for Apollo Server
export function CachePlugin(): ApolloServerPlugin<GraphQLContext> {
  return {
    async requestDidStart() {
      return {
        async willSendResponse(requestContext) {
          const { response, contextValue } = requestContext;
          
          // Add cache headers
          if (response.http) {
            const cacheControl = getCacheControl(requestContext);
            if (cacheControl) {
              response.http.headers.set('Cache-Control', cacheControl);
            }
            
            // Add cache statistics
            if (contextValue?.cache) {
              const stats = contextValue.cache.getStats();
              response.http.headers.set(
                'X-Cache-Hit-Rate',
                stats.hitRate.toFixed(2)
              );
            }
          }
        },
      };
    },
  };
}

// Cache control directive
function getCacheControl(requestContext: any): string | null {
  const { operation } = requestContext;
  
  if (!operation) {
    return null;
  }
  
  // Don't cache mutations or subscriptions
  if (operation.operation !== 'query') {
    return 'no-cache, no-store';
  }
  
  // Check for @cacheControl directive
  const cacheHint = extractCacheHint(operation);
  if (cacheHint) {
    return `max-age=${cacheHint.maxAge}, ${cacheHint.scope}`;
  }
  
  // Default cache control for queries
  return 'max-age=60, public';
}

function extractCacheHint(operation: any): CacheHint | null {
  // Extract cache hints from the operation
  // This is a simplified version - implement based on your needs
  return {
    maxAge: 300,
    scope: 'public',
  };
}

interface CacheHint {
  maxAge: number;
  scope: 'public' | 'private';
}

// Decorator for caching resolver results
export function withCache(options?: { ttl?: number; tags?: string[] }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const context = args.find(arg => arg.cache) as GraphQLContext;
      
      if (!context?.cache) {
        return originalMethod.apply(this, args);
      }
      
      // Generate cache key
      const cacheKey = context.cache.generateKey(
        `${target.constructor.name}.${propertyKey}`,
        args[0], // First argument is usually the input
        { userId: context.user?.id }
      );
      
      // Check cache
      const cached = await context.cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute resolver
      const result = await originalMethod.apply(this, args);
      
      // Cache result
      if (result !== null && result !== undefined) {
        await context.cache.set(
          cacheKey,
          result,
          options?.ttl
        );
        
        // Tag cache entry
        if (options?.tags) {
          for (const tag of options.tags) {
            await context.cache.set(
              `${cacheKey}:tag:${tag}`,
              true,
              options.ttl
            );
          }
        }
      }
      
      return result;
    };
    
    return descriptor;
  };
}

// Intelligent cache invalidation
export class CacheInvalidator {
  private rules: InvalidationRule[] = [];
  
  addRule(rule: InvalidationRule) {
    this.rules.push(rule);
  }
  
  async processInvalidation(
    operation: string,
    entity: string,
    cache: GraphQLCache
  ): Promise<void> {
    const applicableRules = this.rules.filter(
      rule => rule.operation === operation && rule.entity === entity
    );
    
    for (const rule of applicableRules) {
      await cache.invalidate(rule.pattern);
      
      if (rule.cascade) {
        for (const cascadeEntity of rule.cascade) {
          await this.processInvalidation(
            'UPDATE',
            cascadeEntity,
            cache
          );
        }
      }
    }
  }
}

interface InvalidationRule {
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  pattern: string;
  cascade?: string[];
}

// Pre-configured invalidation rules
export const defaultInvalidationRules: InvalidationRule[] = [
  {
    operation: 'CREATE',
    entity: 'Service',
    pattern: 'gql:*services*',
    cascade: ['ServiceStats'],
  },
  {
    operation: 'UPDATE',
    entity: 'Service',
    pattern: 'gql:*service*',
    cascade: ['ServiceStats', 'ServiceHealth'],
  },
  {
    operation: 'DELETE',
    entity: 'Service',
    pattern: 'gql:*service*',
    cascade: ['ServiceStats'],
  },
  {
    operation: 'CREATE',
    entity: 'Plugin',
    pattern: 'gql:*plugins*',
  },
  {
    operation: 'UPDATE',
    entity: 'Plugin',
    pattern: 'gql:*plugin*',
  },
  {
    operation: 'CREATE',
    entity: 'Template',
    pattern: 'gql:*templates*',
  },
  {
    operation: 'UPDATE',
    entity: 'Template',
    pattern: 'gql:*template*',
  },
];