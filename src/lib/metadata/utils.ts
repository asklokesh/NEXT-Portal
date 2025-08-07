import { 
  MetadataSchema, 
  FieldDefinition, 
  FieldType, 
  ValidationRule,
  metadataSchemaManager 
} from './MetadataSchemaManager';
import { 
  MetadataFormData, 
  FormValidationError, 
  FieldTypeConfig,
  MetadataUsageStats,
  SchemaInsights
} from '@/types/metadata';
import { 
  Type, 
  Hash, 
  ToggleLeft, 
  List, 
  Calendar, 
  Code, 
  Link, 
  Mail 
} from 'lucide-react';

/**
 * Field type configurations with UI metadata
 */
export const FIELD_TYPE_CONFIGS: FieldTypeConfig[] = [
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    description: 'Single line text input',
    defaultProps: { placeholder: 'Enter text...' },
    supportedValidations: ['required', 'pattern', 'minLength', 'maxLength', 'custom'],
  },
  {
    type: 'number',
    label: 'Number',
    icon: Hash,
    description: 'Numeric input',
    defaultProps: { placeholder: '0' },
    supportedValidations: ['required', 'min', 'max', 'custom'],
  },
  {
    type: 'boolean',
    label: 'Boolean',
    icon: ToggleLeft,
    description: 'True/false toggle',
    defaultProps: {},
    supportedValidations: ['required', 'custom'],
  },
  {
    type: 'select',
    label: 'Select',
    icon: List,
    description: 'Single selection dropdown',
    defaultProps: { options: [{ label: 'Option 1', value: 'option1' }] },
    supportedValidations: ['required', 'custom'],
  },
  {
    type: 'multi-select',
    label: 'Multi-Select',
    icon: List,
    description: 'Multiple selection dropdown',
    defaultProps: { options: [{ label: 'Option 1', value: 'option1' }] },
    supportedValidations: ['required', 'custom'],
  },
  {
    type: 'date',
    label: 'Date',
    icon: Calendar,
    description: 'Date picker',
    defaultProps: {},
    supportedValidations: ['required', 'min', 'max', 'custom'],
  },
  {
    type: 'json',
    label: 'JSON',
    icon: Code,
    description: 'JSON object editor',
    defaultProps: { placeholder: '{}' },
    supportedValidations: ['required', 'custom'],
  },
  {
    type: 'url',
    label: 'URL',
    icon: Link,
    description: 'URL input with validation',
    defaultProps: { placeholder: 'https://example.com' },
    supportedValidations: ['required', 'pattern', 'custom'],
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email input with validation',
    defaultProps: { placeholder: 'user@example.com' },
    supportedValidations: ['required', 'pattern', 'custom'],
  },
];

/**
 * Get field type configuration by type
 */
export function getFieldTypeConfig(type: FieldType): FieldTypeConfig | undefined {
  return FIELD_TYPE_CONFIGS.find(config => config.type === type);
}

/**
 * Validate form data against a schema with detailed error information
 */
export function validateFormData(
  schema: MetadataSchema, 
  data: MetadataFormData
): FormValidationError[] {
  const errors: FormValidationError[] = [];
  
  for (const field of schema.fields) {
    const value = data[field.name];
    
    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field.name,
        message: `${field.label} is required`,
        type: 'required',
      });
      continue;
    }
    
    // Skip validation if field is empty and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    // Type-specific validation
    const typeError = validateFieldType(field, value);
    if (typeError) {
      errors.push({
        field: field.name,
        message: typeError,
        type: 'format',
      });
      continue;
    }
    
    // Custom validation rules
    if (field.validation) {
      for (const rule of field.validation) {
        const ruleError = validateFieldRule(field, value, rule);
        if (ruleError) {
          errors.push({
            field: field.name,
            message: ruleError,
            type: 'validation',
          });
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validate field value against its type
 */
function validateFieldType(field: FieldDefinition, value: any): string | null {
  switch (field.type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `${field.label} must be a valid number`;
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${field.label} must be true or false`;
      }
      break;
      
    case 'email':
      if (typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return `${field.label} must be a valid email address`;
        }
      }
      break;
      
    case 'url':
      if (typeof value === 'string') {
        try {
          new URL(value);
        } catch {
          return `${field.label} must be a valid URL`;
        }
      }
      break;
      
    case 'date':
      if (typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return `${field.label} must be a valid date`;
        }
      }
      break;
      
    case 'json':
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch {
          return `${field.label} must be valid JSON`;
        }
      }
      break;
      
    case 'multi-select':
      if (!Array.isArray(value)) {
        return `${field.label} must be an array of values`;
      }
      break;
  }
  
  return null;
}

/**
 * Validate field value against a specific validation rule
 */
function validateFieldRule(
  field: FieldDefinition, 
  value: any, 
  rule: ValidationRule
): string | null {
  switch (rule.type) {
    case 'pattern':
      if (typeof value === 'string' && rule.value) {
        const regex = new RegExp(rule.value as string);
        if (!regex.test(value)) {
          return rule.message || `${field.label} does not match the required pattern`;
        }
      }
      break;
      
    case 'min':
      if (typeof value === 'number' && typeof rule.value === 'number') {
        if (value < rule.value) {
          return rule.message || `${field.label} must be at least ${rule.value}`;
        }
      }
      break;
      
    case 'max':
      if (typeof value === 'number' && typeof rule.value === 'number') {
        if (value > rule.value) {
          return rule.message || `${field.label} must be at most ${rule.value}`;
        }
      }
      break;
      
    case 'minLength':
      if (typeof value === 'string' && typeof rule.value === 'number') {
        if (value.length < rule.value) {
          return rule.message || `${field.label} must be at least ${rule.value} characters`;
        }
      }
      break;
      
    case 'maxLength':
      if (typeof value === 'string' && typeof rule.value === 'number') {
        if (value.length > rule.value) {
          return rule.message || `${field.label} must be at most ${rule.value} characters`;
        }
      }
      break;
      
    case 'custom':
      if (rule.customFunction) {
        try {
          const customValidator = new Function('value', 'field', 'data', rule.customFunction);
          const result = customValidator(value, field, {});
          if (result !== true) {
            return typeof result === 'string' 
              ? result 
              : rule.message || `${field.label} failed custom validation`;
          }
        } catch (error) {
          return `Custom validation error for ${field.label}: ${error.message}`;
        }
      }
      break;
  }
  
  return null;
}

/**
 * Generate a new field ID
 */
export function generateFieldId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Generate a field name from a label
 */
export function generateFieldName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Create a default field definition
 */
export function createDefaultField(type: FieldType, label: string): FieldDefinition {
  const config = getFieldTypeConfig(type);
  
  return {
    id: generateFieldId(),
    name: generateFieldName(label),
    label,
    type,
    position: { x: 0, y: 0, width: 12, height: 1 },
    ...config?.defaultProps,
  };
}

/**
 * Deep clone a schema
 */
export function cloneSchema(schema: MetadataSchema): MetadataSchema {
  return JSON.parse(JSON.stringify(schema));
}

/**
 * Deep clone a field definition
 */
export function cloneField(field: FieldDefinition): FieldDefinition {
  return JSON.parse(JSON.stringify(field));
}

/**
 * Check if two schemas are equal
 */
export function schemasEqual(schema1: MetadataSchema, schema2: MetadataSchema): boolean {
  return JSON.stringify(schema1) === JSON.stringify(schema2);
}

/**
 * Get default value for a field type
 */
export function getDefaultFieldValue(field: FieldDefinition): any {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'select':
      return field.options?.[0]?.value || '';
    case 'multi-select':
      return [];
    case 'date':
      return '';
    case 'json':
      return {};
    default:
      return '';
  }
}

/**
 * Initialize form data with default values
 */
export function initializeFormData(schema: MetadataSchema, initialData: MetadataFormData = {}): MetadataFormData {
  const data = { ...initialData };
  
  for (const field of schema.fields) {
    if (!(field.name in data)) {
      data[field.name] = getDefaultFieldValue(field);
    }
  }
  
  return data;
}

/**
 * Clean form data by removing fields not in schema
 */
export function cleanFormData(schema: MetadataSchema, data: MetadataFormData): MetadataFormData {
  const fieldNames = new Set(schema.fields.map(f => f.name));
  const cleanedData: MetadataFormData = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (fieldNames.has(key)) {
      cleanedData[key] = value;
    }
  }
  
  return cleanedData;
}

/**
 * Convert form data to query string
 */
export function dataToQueryString(data: MetadataFormData): string {
  const params = new URLSearchParams();
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        params.set(key, JSON.stringify(value));
      } else if (typeof value === 'object') {
        params.set(key, JSON.stringify(value));
      } else {
        params.set(key, String(value));
      }
    }
  }
  
  return params.toString();
}

/**
 * Parse query string to form data
 */
export function queryStringToData(queryString: string): MetadataFormData {
  const params = new URLSearchParams(queryString);
  const data: MetadataFormData = {};
  
  for (const [key, value] of params.entries()) {
    try {
      // Try to parse as JSON first
      data[key] = JSON.parse(value);
    } catch {
      // Fallback to string value
      data[key] = value;
    }
  }
  
  return data;
}

/**
 * Format field value for display
 */
export function formatFieldValue(field: FieldDefinition, value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  switch (field.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'multi-select':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    case 'json':
      return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    case 'date':
      if (typeof value === 'string') {
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return String(value);
        }
      }
      return String(value);
    default:
      return String(value);
  }
}

/**
 * Get field summary for analytics
 */
export function getFieldSummary(field: FieldDefinition, values: any[]): {
  totalValues: number;
  emptyValues: number;
  uniqueValues: number;
  commonValues: Array<{ value: any; count: number }>;
} {
  const totalValues = values.length;
  const emptyValues = values.filter(v => v === undefined || v === null || v === '').length;
  
  // Count value occurrences
  const valueCounts = new Map<string, number>();
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
      valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
    }
  }
  
  const uniqueValues = valueCounts.size;
  const commonValues = Array.from(valueCounts.entries())
    .map(([value, count]) => ({ 
      value: value.startsWith('{') || value.startsWith('[') ? JSON.parse(value) : value, 
      count 
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalValues,
    emptyValues,
    uniqueValues,
    commonValues,
  };
}

/**
 * Calculate metadata usage statistics
 */
export function calculateUsageStats(
  schema: MetadataSchema, 
  allEntityData: Array<{ entityId: string; data: MetadataFormData }>
): MetadataUsageStats {
  const totalEntities = allEntityData.length;
  const fieldUsage: Record<string, any> = {};
  const validationErrors: Record<string, number> = {};
  
  for (const field of schema.fields) {
    const values = allEntityData.map(entity => entity.data[field.name]);
    const summary = getFieldSummary(field, values);
    
    fieldUsage[field.name] = {
      populated: summary.totalValues - summary.emptyValues,
      percentage: totalEntities > 0 ? ((summary.totalValues - summary.emptyValues) / totalEntities) * 100 : 0,
      commonValues: summary.commonValues.slice(0, 5),
    };
    
    // Count validation errors for this field
    let errorCount = 0;
    for (const entity of allEntityData) {
      const errors = validateFormData(schema, entity.data);
      errorCount += errors.filter(e => e.field === field.name).length;
    }
    
    if (errorCount > 0) {
      validationErrors[field.name] = errorCount;
    }
  }
  
  return {
    schemaId: schema.id,
    totalEntities,
    fieldUsage,
    validationErrors,
    lastUpdated: new Date(),
  };
}

/**
 * Generate insights and recommendations for a schema
 */
export function generateSchemaInsights(
  schema: MetadataSchema, 
  usage: MetadataUsageStats
): SchemaInsights {
  const recommendations: SchemaInsights['recommendations'] = [];
  
  // Check for unused fields
  for (const field of schema.fields) {
    const fieldUsage = usage.fieldUsage[field.name];
    if (fieldUsage && fieldUsage.percentage < 10) {
      recommendations.push({
        type: 'unused_field',
        field: field.name,
        message: `Field "${field.label}" is only used by ${fieldUsage.percentage.toFixed(1)}% of entities`,
        severity: fieldUsage.percentage < 5 ? 'high' : 'medium',
        autoFixable: false,
      });
    }
  }
  
  // Check for fields without validation
  for (const field of schema.fields) {
    if (field.required && (!field.validation || field.validation.length === 0)) {
      recommendations.push({
        type: 'missing_validation',
        field: field.name,
        message: `Required field "${field.label}" has no validation rules`,
        severity: 'medium',
        autoFixable: true,
      });
    }
  }
  
  // Check for common values that could become select options
  for (const field of schema.fields) {
    if (field.type === 'text' && !field.validation?.some(v => v.type === 'pattern')) {
      const fieldUsage = usage.fieldUsage[field.name];
      if (fieldUsage && fieldUsage.commonValues && fieldUsage.commonValues.length <= 10) {
        const topValue = fieldUsage.commonValues[0];
        if (topValue && topValue.count > usage.totalEntities * 0.3) {
          recommendations.push({
            type: 'common_value',
            field: field.name,
            message: `Field "${field.label}" has common values that could be converted to select options`,
            severity: 'low',
            autoFixable: true,
          });
        }
      }
    }
  }
  
  return {
    usage,
    recommendations,
  };
}

/**
 * Sanitize field name to be safe for use as HTML id/name
 */
export function sanitizeFieldName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Check if a field is visible based on conditional rules
 */
export function isFieldVisible(
  field: FieldDefinition, 
  formData: MetadataFormData
): boolean {
  if (!field.conditional) {
    return true;
  }
  
  // Check hide conditions first
  if (field.conditional.hide) {
    for (const rule of field.conditional.hide) {
      if (evaluateConditionalRule(rule, formData)) {
        return false;
      }
    }
  }
  
  // Check show conditions
  if (field.conditional.show) {
    return field.conditional.show.some(rule => evaluateConditionalRule(rule, formData));
  }
  
  return true;
}

/**
 * Evaluate a single conditional rule
 */
function evaluateConditionalRule(rule: any, formData: MetadataFormData): boolean {
  const fieldValue = formData[rule.field];
  
  switch (rule.operator) {
    case 'equals':
      return fieldValue === rule.value;
    case 'not_equals':
      return fieldValue !== rule.value;
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(rule.value);
    case 'not_contains':
      return typeof fieldValue !== 'string' || !fieldValue.includes(rule.value);
    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > rule.value;
    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < rule.value;
    default:
      return false;
  }
}

/**
 * Export utilities for external use
 */
export const MetadataUtils = {
  validateFormData,
  generateFieldId,
  generateFieldName,
  createDefaultField,
  cloneSchema,
  cloneField,
  schemasEqual,
  getDefaultFieldValue,
  initializeFormData,
  cleanFormData,
  dataToQueryString,
  queryStringToData,
  formatFieldValue,
  getFieldSummary,
  calculateUsageStats,
  generateSchemaInsights,
  sanitizeFieldName,
  isFieldVisible,
  getFieldTypeConfig,
};