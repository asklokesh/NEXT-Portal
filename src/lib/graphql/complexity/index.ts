/**
 * Query Complexity Analysis and Rate Limiting
 */

import {
  GraphQLSchema,
  ValidationContext,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  DocumentNode,
} from 'graphql';
import { getComplexity, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';
import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLContext } from '../types';

export interface ComplexityPluginOptions {
  maxDepth: number;
  maxComplexity: number;
  scalarCost?: number;
  objectCost?: number;
  listFactor?: number;
  introspectionCost?: number;
  depthCostFactor?: number;
  onComplete?: (complexity: number) => void;
}

export function ComplexityPlugin(
  options: ComplexityPluginOptions
): ApolloServerPlugin<GraphQLContext> {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext) {
          const { request, document, schema } = requestContext;
          
          // Calculate query depth
          const depth = calculateQueryDepth(document);
          if (depth > options.maxDepth) {
            throw new Error(
              `Query depth ${depth} exceeds maximum depth of ${options.maxDepth}`
            );
          }
          
          // Calculate query complexity
          const complexity = getComplexity({
            schema,
            operationName: request.operationName,
            query: document,
            variables: request.variables || {},
            estimators: [
              fieldExtensionsEstimator(),
              simpleEstimator({
                defaultComplexity: options.scalarCost || 1,
              }),
            ],
          });
          
          if (complexity > options.maxComplexity) {
            throw new Error(
              `Query complexity ${complexity} exceeds maximum complexity of ${options.maxComplexity}`
            );
          }
          
          // Store metrics in context
          if (requestContext.contextValue) {
            (requestContext.contextValue as any).queryMetrics = {
              depth,
              complexity,
            };
          }
          
          // Call completion handler
          if (options.onComplete) {
            options.onComplete(complexity);
          }
        },
      };
    },
  };
}

// Calculate query depth
function calculateQueryDepth(document: DocumentNode): number {
  const fragments = new Map<string, FragmentDefinitionNode>();
  const operationDefinition = document.definitions.find(
    (def) => def.kind === 'OperationDefinition'
  ) as OperationDefinitionNode | undefined;
  
  if (!operationDefinition) {
    return 0;
  }
  
  // Collect fragments
  document.definitions.forEach((def) => {
    if (def.kind === 'FragmentDefinition') {
      fragments.set(def.name.value, def);
    }
  });
  
  return calculateSelectionSetDepth(
    operationDefinition.selectionSet.selections,
    fragments
  );
}

function calculateSelectionSetDepth(
  selections: readonly any[],
  fragments: Map<string, FragmentDefinitionNode>
): number {
  let maxDepth = 0;
  
  for (const selection of selections) {
    let depth = 0;
    
    if (selection.kind === 'Field') {
      const field = selection as FieldNode;
      if (field.selectionSet) {
        depth = 1 + calculateSelectionSetDepth(
          field.selectionSet.selections,
          fragments
        );
      } else {
        depth = 1;
      }
    } else if (selection.kind === 'InlineFragment') {
      const inlineFragment = selection as InlineFragmentNode;
      depth = calculateSelectionSetDepth(
        inlineFragment.selectionSet.selections,
        fragments
      );
    } else if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value;
      const fragment = fragments.get(fragmentName);
      if (fragment) {
        depth = calculateSelectionSetDepth(
          fragment.selectionSet.selections,
          fragments
        );
      }
    }
    
    maxDepth = Math.max(maxDepth, depth);
  }
  
  return maxDepth;
}

// Complexity scoring system
export class ComplexityScorer {
  private readonly weights = {
    scalar: 1,
    object: 2,
    list: 10,
    connection: 20,
    computation: 5,
    aggregation: 15,
    search: 25,
    mutation: 10,
    subscription: 5,
  };
  
  calculateFieldComplexity(
    fieldName: string,
    args: Record<string, any>,
    childComplexity: number
  ): number {
    let complexity = this.weights.scalar;
    
    // List multiplier
    if (args.first || args.last || args.limit) {
      const limit = args.first || args.last || args.limit || 20;
      complexity *= Math.min(limit, 100) / 10;
    }
    
    // Search multiplier
    if (args.search || args.filter) {
      complexity += this.weights.search;
    }
    
    // Aggregation multiplier
    if (fieldName.includes('stats') || fieldName.includes('aggregate')) {
      complexity += this.weights.aggregation;
    }
    
    // Add child complexity
    complexity += childComplexity;
    
    return Math.ceil(complexity);
  }
  
  calculateMutationComplexity(
    mutationName: string,
    args: Record<string, any>
  ): number {
    let complexity = this.weights.mutation;
    
    // Batch operations
    if (args.input && Array.isArray(args.input)) {
      complexity *= args.input.length;
    }
    
    // File uploads
    if (mutationName.includes('upload')) {
      complexity += 50;
    }
    
    // Bulk operations
    if (mutationName.includes('bulk') || mutationName.includes('batch')) {
      complexity += 30;
    }
    
    return complexity;
  }
  
  calculateSubscriptionComplexity(
    subscriptionName: string
  ): number {
    return this.weights.subscription;
  }
}

// Rate limiting based on complexity
export class ComplexityBasedRateLimiter {
  private readonly budgets = new Map<string, ComplexityBudget>();
  private readonly defaultBudget = 10000;
  private readonly windowMs = 60000; // 1 minute
  
  async checkLimit(
    userId: string,
    complexity: number
  ): Promise<RateLimitResult> {
    const budget = this.getBudget(userId);
    const now = Date.now();
    
    // Reset if window expired
    if (now - budget.windowStart > this.windowMs) {
      budget.used = 0;
      budget.windowStart = now;
    }
    
    // Check if complexity exceeds remaining budget
    const remaining = budget.limit - budget.used;
    if (complexity > remaining) {
      return {
        allowed: false,
        limit: budget.limit,
        remaining: remaining,
        resetAt: new Date(budget.windowStart + this.windowMs),
      };
    }
    
    // Update used complexity
    budget.used += complexity;
    
    return {
      allowed: true,
      limit: budget.limit,
      remaining: budget.limit - budget.used,
      resetAt: new Date(budget.windowStart + this.windowMs),
    };
  }
  
  private getBudget(userId: string): ComplexityBudget {
    if (!this.budgets.has(userId)) {
      this.budgets.set(userId, {
        limit: this.defaultBudget,
        used: 0,
        windowStart: Date.now(),
      });
    }
    return this.budgets.get(userId)!;
  }
  
  setBudgetLimit(userId: string, limit: number) {
    const budget = this.getBudget(userId);
    budget.limit = limit;
  }
  
  resetBudget(userId: string) {
    this.budgets.delete(userId);
  }
}

interface ComplexityBudget {
  limit: number;
  used: number;
  windowStart: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}