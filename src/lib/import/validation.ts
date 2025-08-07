import { z } from 'zod';
import { ImportError } from './BulkImporter';

// Common validation schemas
export const EntityMetadataSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(63, 'Name must be 63 characters or less')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Name must contain only lowercase letters, numbers, and hyphens, and start/end with alphanumeric characters'),
  namespace: z.string()
    .max(63, 'Namespace must be 63 characters or less')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Namespace must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  title: z.string().max(255, 'Title must be 255 characters or less').optional(),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  labels: z.record(z.string()).optional(),
  annotations: z.record(z.string()).optional(),
  tags: z.array(z.string().max(63, 'Tags must be 63 characters or less')).max(50, 'Maximum 50 tags allowed').optional(),
});

export const BaseEntitySchema = z.object({
  apiVersion: z.string().min(1, 'API version is required'),
  kind: z.enum(['Component', 'API', 'Resource', 'System', 'Domain', 'Group', 'User', 'Location'], {
    errorMap: () => ({ message: 'Kind must be one of: Component, API, Resource, System, Domain, Group, User, Location' }),
  }),
  metadata: EntityMetadataSchema,
  spec: z.record(z.any()).optional(),
  relations: z.array(z.object({
    type: z.string(),
    targetRef: z.string(),
    target: z.object({
      kind: z.string(),
      namespace: z.string().optional(),
      name: z.string(),
    }),
  })).optional(),
});

// Specific entity schemas
export const ComponentSchema = BaseEntitySchema.extend({
  kind: z.literal('Component'),
  spec: z.object({
    type: z.enum(['service', 'website', 'library'], {
      errorMap: () => ({ message: 'Component type must be one of: service, website, library' }),
    }),
    lifecycle: z.enum(['experimental', 'production', 'deprecated'], {
      errorMap: () => ({ message: 'Lifecycle must be one of: experimental, production, deprecated' }),
    }),
    owner: z.string().min(1, 'Owner is required'),
    system: z.string().optional(),
    subcomponentOf: z.string().optional(),
    providesApis: z.array(z.string()).optional(),
    consumesApis: z.array(z.string()).optional(),
    dependsOn: z.array(z.string()).optional(),
  }).optional(),
});

export const APISchema = BaseEntitySchema.extend({
  kind: z.literal('API'),
  spec: z.object({
    type: z.enum(['openapi', 'asyncapi', 'graphql', 'grpc'], {
      errorMap: () => ({ message: 'API type must be one of: openapi, asyncapi, graphql, grpc' }),
    }),
    lifecycle: z.enum(['experimental', 'production', 'deprecated'], {
      errorMap: () => ({ message: 'Lifecycle must be one of: experimental, production, deprecated' }),
    }),
    owner: z.string().min(1, 'Owner is required'),
    system: z.string().optional(),
    definition: z.string().min(1, 'API definition is required'),
  }).optional(),
});

export const ResourceSchema = BaseEntitySchema.extend({
  kind: z.literal('Resource'),
  spec: z.object({
    type: z.enum(['database', 'storage', 'queue', 'cache', 'cdn', 'load-balancer', 'dns', 'certificate'], {
      errorMap: () => ({ message: 'Resource type must be one of: database, storage, queue, cache, cdn, load-balancer, dns, certificate' }),
    }),
    owner: z.string().min(1, 'Owner is required'),
    system: z.string().optional(),
    dependsOn: z.array(z.string()).optional(),
  }).optional(),
});

export const SystemSchema = BaseEntitySchema.extend({
  kind: z.literal('System'),
  spec: z.object({
    owner: z.string().min(1, 'Owner is required'),
    domain: z.string().optional(),
  }).optional(),
});

/**
 * Validation utility class
 */
export class EntityValidator {
  private static schemaMap = new Map([
    ['Component', ComponentSchema],
    ['API', APISchema],
    ['Resource', ResourceSchema],
    ['System', SystemSchema],
  ]);

  /**
   * Validate a single entity
   */
  static validateEntity(entity: any, rowIndex?: number): ImportError[] {
    const errors: ImportError[] = [];

    try {
      // First validate base structure
      const baseValidation = BaseEntitySchema.safeParse(entity);
      if (!baseValidation.success) {
        baseValidation.error.issues.forEach(issue => {
          errors.push({
            row: rowIndex,
            field: issue.path.join('.'),
            message: issue.message,
            code: 'VALIDATION_ERROR',
            severity: 'error',
            suggestions: this.getSuggestions(issue),
          });
        });
        return errors;
      }

      // Then validate specific entity type
      const entityKind = entity.kind;
      const specificSchema = this.schemaMap.get(entityKind);
      
      if (specificSchema) {
        const specificValidation = specificSchema.safeParse(entity);
        if (!specificValidation.success) {
          specificValidation.error.issues.forEach(issue => {
            errors.push({
              row: rowIndex,
              field: issue.path.join('.'),
              message: issue.message,
              code: 'VALIDATION_ERROR',
              severity: 'error',
              suggestions: this.getSuggestions(issue),
            });
          });
        }
      }

      // Additional business logic validations
      const businessErrors = this.validateBusinessRules(entity, rowIndex);
      errors.push(...businessErrors);

    } catch (error) {
      errors.push({
        row: rowIndex,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_EXCEPTION',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Validate business rules
   */
  private static validateBusinessRules(entity: any, rowIndex?: number): ImportError[] {
    const errors: ImportError[] = [];

    // Check for circular dependencies
    if (entity.spec?.dependsOn) {
      const dependencies = Array.isArray(entity.spec.dependsOn) 
        ? entity.spec.dependsOn 
        : [entity.spec.dependsOn];
      
      const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
      
      if (dependencies.includes(entityRef)) {
        errors.push({
          row: rowIndex,
          field: 'spec.dependsOn',
          message: 'Entity cannot depend on itself',
          code: 'CIRCULAR_DEPENDENCY',
          severity: 'error',
          suggestions: ['Remove self-reference from dependencies'],
        });
      }
    }

    // Validate entity references format
    const referenceFields = ['spec.dependsOn', 'spec.providesApis', 'spec.consumesApis'];
    
    referenceFields.forEach(field => {
      const value = this.getNestedValue(entity, field);
      if (value) {
        const references = Array.isArray(value) ? value : [value];
        
        references.forEach((ref: string, index: number) => {
          if (typeof ref === 'string' && !this.isValidEntityReference(ref)) {
            errors.push({
              row: rowIndex,
              field: `${field}[${index}]`,
              message: `Invalid entity reference format: ${ref}`,
              code: 'INVALID_REFERENCE',
              severity: 'error',
              suggestions: [
                'Use format: kind:namespace/name',
                'Example: component:default/my-service',
              ],
            });
          }
        });
      }
    });

    // Validate owner exists (in a real scenario, you'd check against actual teams/users)
    if (entity.spec?.owner) {
      const owner = entity.spec.owner;
      if (!this.isValidOwner(owner)) {
        errors.push({
          row: rowIndex,
          field: 'spec.owner',
          message: `Owner "${owner}" may not exist`,
          code: 'INVALID_OWNER',
          severity: 'warning',
          suggestions: [
            'Verify the owner exists in your organization',
            'Use team names or user identifiers',
          ],
        });
      }
    }

    // Validate annotations
    if (entity.metadata?.annotations) {
      Object.entries(entity.metadata.annotations).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push({
            row: rowIndex,
            field: `metadata.annotations.${key}`,
            message: 'Annotation values must be strings',
            code: 'INVALID_ANNOTATION',
            severity: 'error',
          });
        }

        // Check for common annotation patterns
        if (key.includes('backstage.io/source-location') && !this.isValidUrl(value as string)) {
          errors.push({
            row: rowIndex,
            field: `metadata.annotations.${key}`,
            message: 'Source location must be a valid URL',
            code: 'INVALID_URL',
            severity: 'error',
            suggestions: ['Use a complete URL with protocol (https://...)'],
          });
        }
      });
    }

    return errors;
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Validate entity reference format
   */
  private static isValidEntityReference(ref: string): boolean {
    // Format: kind:namespace/name or kind:name (default namespace)
    const patterns = [
      /^[a-zA-Z][a-zA-Z0-9]*:[a-z0-9]([a-z0-9-]*[a-z0-9])?\/[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      /^[a-zA-Z][a-zA-Z0-9]*:[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    ];
    
    return patterns.some(pattern => pattern.test(ref));
  }

  /**
   * Validate owner (simplified check)
   */
  private static isValidOwner(owner: string): boolean {
    // In a real implementation, this would check against your identity provider
    // For now, just check basic format
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(owner);
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get suggestions for validation errors
   */
  private static getSuggestions(issue: z.ZodIssue): string[] {
    const suggestions: string[] = [];

    switch (issue.code) {
      case 'too_small':
        if (issue.type === 'string') {
          suggestions.push(`Minimum length is ${issue.minimum} characters`);
        }
        break;
      
      case 'too_big':
        if (issue.type === 'string') {
          suggestions.push(`Maximum length is ${issue.maximum} characters`);
        } else if (issue.type === 'array') {
          suggestions.push(`Maximum ${issue.maximum} items allowed`);
        }
        break;
      
      case 'invalid_string':
        if (issue.validation === 'regex') {
          suggestions.push('Use only lowercase letters, numbers, and hyphens');
          suggestions.push('Start and end with alphanumeric characters');
        }
        break;
      
      case 'invalid_enum_value':
        suggestions.push(`Valid options are: ${issue.options?.join(', ')}`);
        break;
      
      case 'invalid_type':
        suggestions.push(`Expected ${issue.expected}, got ${issue.received}`);
        break;
    }

    return suggestions;
  }

  /**
   * Validate batch of entities
   */
  static validateBatch(entities: any[]): { valid: any[]; invalid: any[]; errors: ImportError[] } {
    const valid: any[] = [];
    const invalid: any[] = [];
    const allErrors: ImportError[] = [];

    entities.forEach((entity, index) => {
      const errors = this.validateEntity(entity, index + 1);
      
      if (errors.length === 0) {
        valid.push(entity);
      } else {
        invalid.push(entity);
        allErrors.push(...errors);
      }
    });

    return { valid, invalid, errors: allErrors };
  }
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
  /**
   * Attempt to fix common entity errors
   */
  static attemptAutoFix(entity: any, errors: ImportError[]): { 
    fixed: any; 
    remainingErrors: ImportError[];
    applied: string[]; 
  } {
    let fixed = { ...entity };
    const applied: string[] = [];
    const remainingErrors: ImportError[] = [];

    errors.forEach(error => {
      let wasFixed = false;

      switch (error.code) {
        case 'VALIDATION_ERROR':
          if (error.field === 'metadata.name') {
            // Fix name formatting
            if (fixed.metadata?.name) {
              const originalName = fixed.metadata.name;
              fixed.metadata.name = this.fixEntityName(originalName);
              if (fixed.metadata.name !== originalName) {
                applied.push(`Fixed name format: "${originalName}" → "${fixed.metadata.name}"`);
                wasFixed = true;
              }
            }
          } else if (error.field === 'metadata.namespace') {
            // Fix namespace formatting
            if (fixed.metadata?.namespace) {
              const originalNamespace = fixed.metadata.namespace;
              fixed.metadata.namespace = this.fixEntityName(originalNamespace);
              if (fixed.metadata.namespace !== originalNamespace) {
                applied.push(`Fixed namespace format: "${originalNamespace}" → "${fixed.metadata.namespace}"`);
                wasFixed = true;
              }
            }
          }
          break;

        case 'INVALID_REFERENCE':
          // Fix entity reference format
          if (error.field?.includes('dependsOn') || error.field?.includes('Api')) {
            const fieldPath = error.field.split('.');
            const value = this.getNestedValue(fixed, fieldPath);
            
            if (Array.isArray(value)) {
              const index = parseInt(error.field.match(/\[(\d+)\]/)?.[1] || '0', 10);
              if (value[index] && typeof value[index] === 'string') {
                const originalRef = value[index];
                const fixedRef = this.fixEntityReference(originalRef);
                if (fixedRef !== originalRef) {
                  value[index] = fixedRef;
                  applied.push(`Fixed reference format: "${originalRef}" → "${fixedRef}"`);
                  wasFixed = true;
                }
              }
            }
          }
          break;
      }

      if (!wasFixed) {
        remainingErrors.push(error);
      }
    });

    return { fixed, remainingErrors, applied };
  }

  /**
   * Fix entity name format
   */
  private static fixEntityName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Fix entity reference format
   */
  private static fixEntityReference(ref: string): string {
    // If it's just a name, assume it's a component in default namespace
    if (!ref.includes(':') && !ref.includes('/')) {
      return `component:default/${ref}`;
    }
    
    // If it has namespace but no kind, assume component
    if (ref.includes('/') && !ref.includes(':')) {
      return `component:${ref}`;
    }
    
    return ref;
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string[]): any {
    return path.reduce((current, key) => {
      if (key.includes('[') && key.includes(']')) {
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''), 10);
        return current?.[arrayKey]?.[index];
      }
      return current?.[key];
    }, obj);
  }
}

export default EntityValidator;