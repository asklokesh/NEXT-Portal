import { z } from 'zod';
import { Redis } from 'ioredis';

export interface TransformationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: TransformationCondition[];
  requestTransformations?: RequestTransformation[];
  responseTransformations?: ResponseTransformation[];
  order: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TransformationCondition {
  type: 'path' | 'method' | 'header' | 'query' | 'body' | 'consumer';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'exists';
  field?: string;
  value: string;
  caseSensitive?: boolean;
}

export interface RequestTransformation {
  type: 'add_header' | 'remove_header' | 'replace_header' | 'add_query' | 'remove_query' | 'replace_query' | 'modify_body' | 'validate_schema';
  field?: string;
  value?: string;
  oldValue?: string;
  newValue?: string;
  schema?: any;
  bodyTransform?: BodyTransformation;
}

export interface ResponseTransformation {
  type: 'add_header' | 'remove_header' | 'replace_header' | 'modify_body' | 'modify_status' | 'cache_control';
  field?: string;
  value?: string;
  oldValue?: string;
  newValue?: string;
  statusCode?: number;
  bodyTransform?: BodyTransformation;
  cacheDirectives?: CacheDirectives;
}

export interface BodyTransformation {
  operation: 'add_field' | 'remove_field' | 'rename_field' | 'transform_field' | 'filter_fields' | 'merge_objects' | 'wrap_response';
  path?: string;
  value?: any;
  oldPath?: string;
  newPath?: string;
  transformer?: string; // JavaScript function as string
  allowedFields?: string[];
  wrapperKey?: string;
}

export interface CacheDirectives {
  maxAge?: number;
  sMaxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;
  private?: boolean;
  public?: boolean;
}

const APIRequestSchema = z.object({
  method: z.string(),
  path: z.string(),
  headers: z.record(z.string()),
  query: z.record(z.string()),
  body: z.any().optional(),
  consumer: z.object({
    id: z.string(),
    username: z.string(),
    groups: z.array(z.string()).optional(),
  }).optional(),
});

const APIResponseSchema = z.object({
  status: z.number(),
  headers: z.record(z.string()),
  body: z.any().optional(),
});

export type APIRequest = z.infer<typeof APIRequestSchema>;
export type APIResponse = z.infer<typeof APIResponseSchema>;

export class RequestResponseTransformer {
  private redis: Redis;
  private transformationRules: Map<string, TransformationRule> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Load transformation rules from Redis
   */
  async loadTransformationRules(): Promise<void> {
    const keys = await this.redis.keys('transformation_rule:*');
    
    for (const key of keys) {
      const data = await this.redis.hget(key, 'data');
      if (data) {
        const rule: TransformationRule = JSON.parse(data);
        this.transformationRules.set(rule.id, rule);
      }
    }
  }

  /**
   * Save transformation rule to Redis
   */
  async saveTransformationRule(rule: TransformationRule): Promise<void> {
    await this.redis.hset(
      `transformation_rule:${rule.id}`,
      'data',
      JSON.stringify(rule)
    );
    this.transformationRules.set(rule.id, rule);
  }

  /**
   * Transform request based on matching rules
   */
  async transformRequest(request: APIRequest): Promise<APIRequest> {
    const matchingRules = this.getMatchingRules(request);
    let transformedRequest = { ...request };

    // Sort rules by order
    const sortedRules = matchingRules.sort((a, b) => a.order - b.order);

    for (const rule of sortedRules) {
      if (!rule.enabled || !rule.requestTransformations) continue;

      for (const transformation of rule.requestTransformations) {
        transformedRequest = await this.applyRequestTransformation(
          transformedRequest,
          transformation
        );
      }
    }

    return transformedRequest;
  }

  /**
   * Transform response based on matching rules
   */
  async transformResponse(
    request: APIRequest,
    response: APIResponse
  ): Promise<APIResponse> {
    const matchingRules = this.getMatchingRules(request);
    let transformedResponse = { ...response };

    // Sort rules by order
    const sortedRules = matchingRules.sort((a, b) => a.order - b.order);

    for (const rule of sortedRules) {
      if (!rule.enabled || !rule.responseTransformations) continue;

      for (const transformation of rule.responseTransformations) {
        transformedResponse = await this.applyResponseTransformation(
          transformedResponse,
          transformation,
          request
        );
      }
    }

    return transformedResponse;
  }

  /**
   * Validate request against schema
   */
  async validateRequest(request: APIRequest, schema: z.ZodSchema): Promise<{
    valid: boolean;
    errors?: string[];
    sanitizedRequest?: APIRequest;
  }> {
    try {
      const sanitizedRequest = schema.parse(request);
      return { valid: true, sanitizedRequest };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return {
        valid: false,
        errors: ['Unknown validation error'],
      };
    }
  }

  /**
   * Apply request transformation
   */
  private async applyRequestTransformation(
    request: APIRequest,
    transformation: RequestTransformation
  ): Promise<APIRequest> {
    const result = { ...request };

    switch (transformation.type) {
      case 'add_header':
        if (transformation.field && transformation.value) {
          result.headers = {
            ...result.headers,
            [transformation.field]: transformation.value,
          };
        }
        break;

      case 'remove_header':
        if (transformation.field && result.headers[transformation.field]) {
          const { [transformation.field]: removed, ...remainingHeaders } = result.headers;
          result.headers = remainingHeaders;
        }
        break;

      case 'replace_header':
        if (transformation.field && transformation.newValue) {
          if (result.headers[transformation.field]) {
            result.headers[transformation.field] = transformation.newValue;
          }
        }
        break;

      case 'add_query':
        if (transformation.field && transformation.value) {
          result.query = {
            ...result.query,
            [transformation.field]: transformation.value,
          };
        }
        break;

      case 'remove_query':
        if (transformation.field && result.query[transformation.field]) {
          const { [transformation.field]: removed, ...remainingQuery } = result.query;
          result.query = remainingQuery;
        }
        break;

      case 'replace_query':
        if (transformation.field && transformation.newValue) {
          if (result.query[transformation.field]) {
            result.query[transformation.field] = transformation.newValue;
          }
        }
        break;

      case 'modify_body':
        if (transformation.bodyTransform && result.body) {
          result.body = await this.applyBodyTransformation(
            result.body,
            transformation.bodyTransform
          );
        }
        break;

      case 'validate_schema':
        if (transformation.schema) {
          const schema = z.object(transformation.schema);
          const validation = await this.validateRequest(result, schema);
          if (!validation.valid) {
            throw new Error(`Schema validation failed: ${validation.errors?.join(', ')}`);
          }
          if (validation.sanitizedRequest) {
            return validation.sanitizedRequest;
          }
        }
        break;
    }

    return result;
  }

  /**
   * Apply response transformation
   */
  private async applyResponseTransformation(
    response: APIResponse,
    transformation: ResponseTransformation,
    request: APIRequest
  ): Promise<APIResponse> {
    const result = { ...response };

    switch (transformation.type) {
      case 'add_header':
        if (transformation.field && transformation.value) {
          result.headers = {
            ...result.headers,
            [transformation.field]: transformation.value,
          };
        }
        break;

      case 'remove_header':
        if (transformation.field && result.headers[transformation.field]) {
          const { [transformation.field]: removed, ...remainingHeaders } = result.headers;
          result.headers = remainingHeaders;
        }
        break;

      case 'replace_header':
        if (transformation.field && transformation.newValue) {
          if (result.headers[transformation.field]) {
            result.headers[transformation.field] = transformation.newValue;
          }
        }
        break;

      case 'modify_body':
        if (transformation.bodyTransform && result.body) {
          result.body = await this.applyBodyTransformation(
            result.body,
            transformation.bodyTransform
          );
        }
        break;

      case 'modify_status':
        if (transformation.statusCode) {
          result.status = transformation.statusCode;
        }
        break;

      case 'cache_control':
        if (transformation.cacheDirectives) {
          const cacheControl = this.buildCacheControlHeader(transformation.cacheDirectives);
          result.headers = {
            ...result.headers,
            'Cache-Control': cacheControl,
          };
        }
        break;
    }

    return result;
  }

  /**
   * Apply body transformation
   */
  private async applyBodyTransformation(
    body: any,
    transformation: BodyTransformation
  ): Promise<any> {
    let result = typeof body === 'object' ? { ...body } : body;

    switch (transformation.operation) {
      case 'add_field':
        if (transformation.path && transformation.value !== undefined) {
          result = this.setNestedProperty(result, transformation.path, transformation.value);
        }
        break;

      case 'remove_field':
        if (transformation.path) {
          result = this.removeNestedProperty(result, transformation.path);
        }
        break;

      case 'rename_field':
        if (transformation.oldPath && transformation.newPath) {
          const value = this.getNestedProperty(result, transformation.oldPath);
          if (value !== undefined) {
            result = this.setNestedProperty(result, transformation.newPath, value);
            result = this.removeNestedProperty(result, transformation.oldPath);
          }
        }
        break;

      case 'transform_field':
        if (transformation.path && transformation.transformer) {
          const value = this.getNestedProperty(result, transformation.path);
          if (value !== undefined) {
            try {
              // Create a safe sandbox for transformation
              const transformFn = new Function('value', `return (${transformation.transformer})(value)`);
              const transformedValue = transformFn(value);
              result = this.setNestedProperty(result, transformation.path, transformedValue);
            } catch (error) {
              console.error('Transformation function error:', error);
            }
          }
        }
        break;

      case 'filter_fields':
        if (transformation.allowedFields && Array.isArray(transformation.allowedFields)) {
          result = this.filterFields(result, transformation.allowedFields);
        }
        break;

      case 'merge_objects':
        if (transformation.value && typeof result === 'object' && typeof transformation.value === 'object') {
          result = { ...result, ...transformation.value };
        }
        break;

      case 'wrap_response':
        if (transformation.wrapperKey) {
          result = { [transformation.wrapperKey]: result };
        }
        break;
    }

    return result;
  }

  /**
   * Get matching transformation rules for request
   */
  private getMatchingRules(request: APIRequest): TransformationRule[] {
    const matchingRules: TransformationRule[] = [];

    for (const rule of this.transformationRules.values()) {
      if (this.ruleMatches(rule, request)) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  /**
   * Check if rule matches request
   */
  private ruleMatches(rule: TransformationRule, request: APIRequest): boolean {
    if (!rule.enabled) return false;

    for (const condition of rule.conditions) {
      if (!this.conditionMatches(condition, request)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if condition matches request
   */
  private conditionMatches(condition: TransformationCondition, request: APIRequest): boolean {
    let targetValue: string;

    switch (condition.type) {
      case 'path':
        targetValue = request.path;
        break;
      case 'method':
        targetValue = request.method;
        break;
      case 'header':
        targetValue = condition.field ? request.headers[condition.field] || '' : '';
        break;
      case 'query':
        targetValue = condition.field ? request.query[condition.field] || '' : '';
        break;
      case 'body':
        if (condition.field && request.body) {
          targetValue = this.getNestedProperty(request.body, condition.field) || '';
        } else {
          targetValue = request.body ? JSON.stringify(request.body) : '';
        }
        break;
      case 'consumer':
        if (condition.field && request.consumer) {
          targetValue = (request.consumer as any)[condition.field] || '';
        } else {
          targetValue = request.consumer?.id || '';
        }
        break;
      default:
        return false;
    }

    const compareValue = condition.caseSensitive ? condition.value : condition.value.toLowerCase();
    const compareTarget = condition.caseSensitive ? targetValue : targetValue.toLowerCase();

    switch (condition.operator) {
      case 'equals':
        return compareTarget === compareValue;
      case 'contains':
        return compareTarget.includes(compareValue);
      case 'starts_with':
        return compareTarget.startsWith(compareValue);
      case 'ends_with':
        return compareTarget.endsWith(compareValue);
      case 'regex':
        try {
          const regex = new RegExp(condition.value);
          return regex.test(targetValue);
        } catch {
          return false;
        }
      case 'exists':
        return targetValue !== '';
      default:
        return false;
    }
  }

  /**
   * Build Cache-Control header from directives
   */
  private buildCacheControlHeader(directives: CacheDirectives): string {
    const parts: string[] = [];

    if (directives.maxAge !== undefined) {
      parts.push(`max-age=${directives.maxAge}`);
    }
    if (directives.sMaxAge !== undefined) {
      parts.push(`s-maxage=${directives.sMaxAge}`);
    }
    if (directives.noCache) {
      parts.push('no-cache');
    }
    if (directives.noStore) {
      parts.push('no-store');
    }
    if (directives.mustRevalidate) {
      parts.push('must-revalidate');
    }
    if (directives.proxyRevalidate) {
      parts.push('proxy-revalidate');
    }
    if (directives.private) {
      parts.push('private');
    }
    if (directives.public) {
      parts.push('public');
    }

    return parts.join(', ');
  }

  /**
   * Helper methods for nested object manipulation
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  private setNestedProperty(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const result = { ...obj };
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return result;
  }

  private removeNestedProperty(obj: any, path: string): any {
    const keys = path.split('.');
    const result = { ...obj };

    if (keys.length === 1) {
      const { [keys[0]]: removed, ...remaining } = result;
      return remaining;
    }

    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return result;
      current = current[keys[i]];
    }

    delete current[keys[keys.length - 1]];
    return result;
  }

  private filterFields(obj: any, allowedFields: string[]): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.filterFields(item, allowedFields));

    const result: any = {};
    for (const field of allowedFields) {
      if (obj.hasOwnProperty(field)) {
        result[field] = obj[field];
      }
    }
    return result;
  }
}

/**
 * Schema validation service
 */
export class SchemaValidator {
  private schemas: Map<string, z.ZodSchema> = new Map();

  /**
   * Register schema for validation
   */
  registerSchema(name: string, schema: z.ZodSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Validate data against registered schema
   */
  validate(schemaName: string, data: any): {
    valid: boolean;
    data?: any;
    errors?: string[];
  } {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return {
        valid: false,
        errors: [`Schema '${schemaName}' not found`],
      };
    }

    try {
      const validatedData = schema.parse(data);
      return { valid: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return {
        valid: false,
        errors: ['Unknown validation error'],
      };
    }
  }

  /**
   * Get all registered schema names
   */
  getSchemaNames(): string[] {
    return Array.from(this.schemas.keys());
  }
}