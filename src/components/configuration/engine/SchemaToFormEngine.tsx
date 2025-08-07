'use client';

import React, { useMemo, useCallback, useEffect } from 'react';
import { useForm, FormProvider, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';

import type { 
  ConfigurationSchema, 
  FormFieldState, 
  FormState,
  ConditionalLogic,
  ValidationConfig,
  FormConfiguration,
  WizardConfiguration
} from '../types/schema';
import { FieldRenderer } from '../fields/FieldRenderer';
import { ValidationEngine } from '../validation/ValidationEngine';
import { useConfigurationStore } from '../store/configurationStore';

interface SchemaToFormEngineProps {
  schema: ConfigurationSchema;
  initialValues?: Record<string, any>;
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
  onValidate?: (valid: boolean, errors: Record<string, string>) => void;
  onChange?: (values: Record<string, any>, changedField?: string) => void;
  mode?: 'form' | 'wizard' | 'inline';
  wizardConfig?: WizardConfiguration;
  readonly?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface FormFieldProps {
  name: string;
  schema: ConfigurationSchema;
  fieldSchema: ConfigurationSchema;
  config: FormConfiguration;
  parentPath?: string;
}

// Generate Zod schema from JSON Schema
function generateZodSchema(schema: ConfigurationSchema): z.ZodSchema {
  const generateFieldSchema = (fieldSchema: ConfigurationSchema): z.ZodSchema => {
    let zodSchema: z.ZodSchema = z.any();

    switch (fieldSchema.type) {
      case 'string':
        zodSchema = z.string();
        if (fieldSchema.minLength !== undefined) {
          zodSchema = zodSchema.min(fieldSchema.minLength);
        }
        if (fieldSchema.maxLength !== undefined) {
          zodSchema = zodSchema.max(fieldSchema.maxLength);
        }
        if (fieldSchema.pattern) {
          zodSchema = zodSchema.regex(new RegExp(fieldSchema.pattern));
        }
        if (fieldSchema.format === 'email') {
          zodSchema = zodSchema.email();
        }
        if (fieldSchema.format === 'url' || fieldSchema.format === 'uri') {
          zodSchema = zodSchema.url();
        }
        break;

      case 'number':
      case 'integer':
        zodSchema = fieldSchema.type === 'integer' ? z.number().int() : z.number();
        if (fieldSchema.minimum !== undefined) {
          zodSchema = zodSchema.min(fieldSchema.minimum);
        }
        if (fieldSchema.maximum !== undefined) {
          zodSchema = zodSchema.max(fieldSchema.maximum);
        }
        break;

      case 'boolean':
        zodSchema = z.boolean();
        break;

      case 'array':
        if (fieldSchema.items) {
          const itemSchema = Array.isArray(fieldSchema.items) 
            ? fieldSchema.items[0] as ConfigurationSchema
            : fieldSchema.items as ConfigurationSchema;
          const itemZodSchema = generateFieldSchema(itemSchema);
          zodSchema = z.array(itemZodSchema);
          
          if (fieldSchema.minItems !== undefined) {
            zodSchema = zodSchema.min(fieldSchema.minItems);
          }
          if (fieldSchema.maxItems !== undefined) {
            zodSchema = zodSchema.max(fieldSchema.maxItems);
          }
        } else {
          zodSchema = z.array(z.any());
        }
        break;

      case 'object':
        if (fieldSchema.properties) {
          const objectShape: Record<string, z.ZodSchema> = {};
          
          Object.entries(fieldSchema.properties).forEach(([key, propSchema]) => {
            objectShape[key] = generateFieldSchema(propSchema as ConfigurationSchema);
            
            // Handle required fields
            if (!fieldSchema.required?.includes(key)) {
              objectShape[key] = objectShape[key].optional();
            }
          });
          
          zodSchema = z.object(objectShape);
        } else {
          zodSchema = z.record(z.any());
        }
        break;

      default:
        if (fieldSchema.enum) {
          zodSchema = z.enum(fieldSchema.enum as [string, ...string[]]);
        } else if (fieldSchema.const) {
          zodSchema = z.literal(fieldSchema.const);
        } else {
          zodSchema = z.any();
        }
        break;
    }

    // Handle nullable
    if (fieldSchema.nullable) {
      zodSchema = zodSchema.nullable();
    }

    // Handle optional (not required)
    if (!schema.required?.includes(fieldSchema.title || '')) {
      zodSchema = zodSchema.optional();
    }

    // Handle default values
    if (fieldSchema.default !== undefined) {
      zodSchema = zodSchema.default(fieldSchema.default);
    }

    return zodSchema;
  };

  if (schema.properties) {
    const shape: Record<string, z.ZodSchema> = {};
    
    Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
      shape[key] = generateFieldSchema(fieldSchema as ConfigurationSchema);
    });

    return z.object(shape);
  }

  return z.record(z.any());
}

// Evaluate conditional logic
function evaluateCondition(
  condition: ConditionalLogic, 
  formValues: Record<string, any>
): boolean {
  const fieldValue = formValues[condition.field];
  const conditionValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'contains':
      return Array.isArray(fieldValue) 
        ? fieldValue.includes(conditionValue)
        : String(fieldValue).includes(String(conditionValue));
    case 'not_contains':
      return Array.isArray(fieldValue)
        ? !fieldValue.includes(conditionValue)
        : !String(fieldValue).includes(String(conditionValue));
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue);
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue);
    case 'greater_equal':
      return Number(fieldValue) >= Number(conditionValue);
    case 'less_equal':
      return Number(fieldValue) <= Number(conditionValue);
    case 'is_empty':
      return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return !!fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0);
    case 'matches':
      return new RegExp(String(conditionValue)).test(String(fieldValue));
    case 'not_matches':
      return !new RegExp(String(conditionValue)).test(String(fieldValue));
    default:
      return true;
  }
}

// Form field component with conditional logic
const FormField: React.FC<FormFieldProps> = ({
  name,
  schema,
  fieldSchema,
  config,
  parentPath = ''
}) => {
  const { watch, formState: { errors } } = useFormContext();
  const formValues = watch();
  
  // Evaluate conditional visibility and state
  const fieldState = useMemo(() => {
    let visible = true;
    let disabled = false;
    let required = schema.required?.includes(name) || false;

    if (config.conditional) {
      const conditionMet = evaluateCondition(config.conditional, formValues);
      
      switch (config.conditional.action) {
        case 'show':
          visible = conditionMet;
          break;
        case 'hide':
          visible = !conditionMet;
          break;
        case 'enable':
          disabled = !conditionMet;
          break;
        case 'disable':
          disabled = conditionMet;
          break;
        case 'require':
          required = conditionMet;
          break;
        case 'optional':
          required = !conditionMet;
          break;
      }
    }

    return {
      visible: visible && !config.hidden,
      disabled: disabled || config.readonly,
      required,
    };
  }, [config, formValues, name, schema.required]);

  if (!fieldState.visible) {
    return null;
  }

  const fullPath = parentPath ? `${parentPath}.${name}` : name;
  const error = errors[name]?.message as string;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={config.grid ? `col-span-${config.grid.md || 12}` : undefined}
      >
        <FieldRenderer
          name={fullPath}
          fieldSchema={fieldSchema}
          config={config}
          required={fieldState.required}
          disabled={fieldState.disabled}
          error={error}
        />
      </motion.div>
    </AnimatePresence>
  );
};

// Form group component for organized layouts
interface FormGroupProps {
  title?: string;
  description?: string;
  fields: Array<{
    name: string;
    schema: ConfigurationSchema;
    config: FormConfiguration;
  }>;
  schema: ConfigurationSchema;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const FormGroup: React.FC<FormGroupProps> = ({
  title,
  description,
  fields,
  schema,
  collapsible = false,
  defaultCollapsed = false
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  if (fields.length === 0) return null;

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      {title && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {collapsible && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 hover:bg-accent rounded-md transition-colors"
              aria-label={collapsed ? 'Expand section' : 'Collapse section'}
            >
              <motion.div
                animate={{ rotate: collapsed ? -90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </motion.div>
            </button>
          )}
        </div>
      )}
      
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-12 gap-4"
          >
            {fields.map(({ name, schema: fieldSchema, config }) => (
              <FormField
                key={name}
                name={name}
                schema={schema}
                fieldSchema={fieldSchema}
                config={config}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Main SchemaToFormEngine component
export const SchemaToFormEngine: React.FC<SchemaToFormEngineProps> = ({
  schema,
  initialValues = {},
  onSubmit,
  onValidate,
  onChange,
  mode = 'form',
  wizardConfig,
  readonly = false,
  className = '',
  children
}) => {
  const { updateFormState } = useConfigurationStore();
  
  // Generate Zod schema for validation
  const zodSchema = useMemo(() => generateZodSchema(schema), [schema]);
  
  // Initialize react-hook-form
  const methods = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });

  const { handleSubmit, watch, formState: { errors, isValid, isDirty } } = methods;
  
  // Watch all form values for conditional logic
  const watchedValues = useWatch({ control: methods.control });

  // Handle form submission
  const onSubmitHandler = useCallback(
    (values: Record<string, any>) => {
      onSubmit?.(values);
    },
    [onSubmit]
  );

  // Handle validation changes
  useEffect(() => {
    onValidate?.(isValid, errors as Record<string, string>);
  }, [isValid, errors, onValidate]);

  // Handle value changes
  useEffect(() => {
    if (isDirty) {
      onChange?.(watchedValues);
      
      // Update global configuration store
      updateFormState({
        values: watchedValues,
        errors: errors as Record<string, string>,
        dirty: isDirty,
        valid: isValid,
      });
    }
  }, [watchedValues, isDirty, isValid, errors, onChange, updateFormState]);

  // Group fields by configuration
  const fieldGroups = useMemo(() => {
    if (!schema.properties) return [];

    const groups: Record<string, Array<{
      name: string;
      schema: ConfigurationSchema;
      config: FormConfiguration;
    }>> = {};

    Object.entries(schema.properties).forEach(([name, fieldSchema]) => {
      const config = (fieldSchema as ConfigurationSchema)['x-form-config'] || {};
      const groupName = config.group || 'default';
      
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      
      groups[groupName].push({
        name,
        schema: fieldSchema as ConfigurationSchema,
        config,
      });
    });

    // Sort fields within groups by order
    Object.values(groups).forEach(group => {
      group.sort((a, b) => (a.config.order || 0) - (b.config.order || 0));
    });

    return groups;
  }, [schema.properties]);

  return (
    <FormProvider {...methods}>
      <ValidationEngine schema={schema} />
      
      <form
        onSubmit={handleSubmit(onSubmitHandler)}
        className={`space-y-6 ${className}`}
        noValidate
      >
        {Object.entries(fieldGroups).map(([groupName, fields]) => (
          <FormGroup
            key={groupName}
            title={groupName === 'default' ? undefined : groupName}
            fields={fields}
            schema={schema}
            collapsible={groupName !== 'default'}
          />
        ))}
        
        {children}
        
        {!readonly && (
          <div className="flex items-center gap-4 pt-6 border-t border-border">
            <button
              type="submit"
              disabled={!isValid}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mode === 'wizard' ? 'Continue' : 'Save Configuration'}
            </button>
            
            {isDirty && (
              <p className="text-sm text-muted-foreground">
                You have unsaved changes
              </p>
            )}
          </div>
        )}
      </form>
    </FormProvider>
  );
};

export default SchemaToFormEngine;