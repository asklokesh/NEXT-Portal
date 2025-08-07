'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { AlertTriangle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import type { 
  ConfigurationSchema, 
  ValidationConfig,
  FormConfiguration 
} from '../types/schema';
import { useDebounce } from '@/hooks/useDebounce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ValidationEngineProps {
  schema: ConfigurationSchema;
  onValidationChange?: (result: ValidationResult) => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  fieldValidations: Record<string, FieldValidation>;
}

interface ValidationError {
  field: string;
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  data?: any;
}

interface FieldValidation {
  isValid: boolean;
  isValidating: boolean;
  errors: string[];
  warnings: string[];
  infos: string[];
  lastValidated?: Date;
}

interface AsyncValidationTask {
  fieldPath: string;
  value: any;
  config: ValidationConfig;
  timestamp: number;
}

// Initialize AJV for JSON Schema validation
const createAjvInstance = () => {
  const ajv = new Ajv({ 
    allErrors: true, 
    verbose: true,
    strict: false,
    validateFormats: true,
  });
  addFormats(ajv);
  
  // Custom formats
  ajv.addFormat('backstage-entity-ref', {
    type: 'string',
    validate: (data: string) => {
      const entityRefPattern = /^(?:([^:]+):)?(?:([^\/]+)\/)?([^\/]+)$/;
      return entityRefPattern.test(data);
    }
  });

  ajv.addFormat('docker-image', {
    type: 'string',
    validate: (data: string) => {
      const dockerImagePattern = /^(?:[a-zA-Z0-9][a-zA-Z0-9-_]*\.)*[a-zA-Z0-9][a-zA-Z0-9-_]*(?::[0-9]+)?\/(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/;
      return dockerImagePattern.test(data);
    }
  });

  return ajv;
};

// Custom validation functions
const CUSTOM_VALIDATORS: Record<string, (value: any, schema: ConfigurationSchema) => string | null> = {
  backstageEntityExists: async (value: string, schema: ConfigurationSchema) => {
    // This would integrate with Backstage catalog API
    // For now, just validate the format
    if (!value) return null;
    
    const entityRefPattern = /^(?:([^:]+):)?(?:([^\/]+)\/)?([^\/]+)$/;
    if (!entityRefPattern.test(value)) {
      return 'Invalid entity reference format. Use [kind:][namespace/]name';
    }
    
    return null;
  },

  uniqueInCatalog: async (value: string, schema: ConfigurationSchema) => {
    // This would check if the entity name is unique in the catalog
    return null; // Placeholder
  },

  validYaml: (value: string) => {
    if (!value) return null;
    
    try {
      // Basic YAML validation - in production, use a proper YAML parser
      if (value.includes('\t')) {
        return 'YAML should use spaces for indentation, not tabs';
      }
      return null;
    } catch (error) {
      return 'Invalid YAML format';
    }
  },

  validJson: (value: string) => {
    if (!value) return null;
    
    try {
      JSON.parse(value);
      return null;
    } catch (error) {
      return 'Invalid JSON format';
    }
  },

  validUrl: (value: string) => {
    if (!value) return null;
    
    try {
      new URL(value);
      return null;
    } catch (error) {
      return 'Invalid URL format';
    }
  },

  strongPassword: (value: string) => {
    if (!value) return null;
    
    const hasLength = value.length >= 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    
    if (!hasLength) return 'Password must be at least 8 characters long';
    if (!hasUpper) return 'Password must contain at least one uppercase letter';
    if (!hasLower) return 'Password must contain at least one lowercase letter';
    if (!hasNumber) return 'Password must contain at least one number';
    if (!hasSpecial) return 'Password must contain at least one special character';
    
    return null;
  },
};

// Async validation queue
class AsyncValidationQueue {
  private queue: AsyncValidationTask[] = [];
  private processing = false;
  private callbacks: Map<string, (result: string | null) => void> = new Map();

  async add(task: AsyncValidationTask, callback: (result: string | null) => void) {
    // Remove existing task for the same field
    this.queue = this.queue.filter(t => t.fieldPath !== task.fieldPath);
    
    // Add new task
    this.queue.push(task);
    this.callbacks.set(task.fieldPath, callback);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;
      
      const callback = this.callbacks.get(task.fieldPath);
      if (!callback) continue;
      
      try {
        // Simulate async validation delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Perform validation based on config
        let result: string | null = null;
        
        if (task.config.apiValidation) {
          result = await this.performApiValidation(task.value, task.config.apiValidation);
        } else if (task.config.customValidation) {
          const validator = CUSTOM_VALIDATORS[task.config.customValidation];
          if (validator) {
            result = await validator(task.value, {} as ConfigurationSchema);
          }
        }
        
        callback(result);
      } catch (error) {
        callback(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      this.callbacks.delete(task.fieldPath);
    }
    
    this.processing = false;
  }

  private async performApiValidation(value: any, apiConfig: ValidationConfig['apiValidation']): Promise<string | null> {
    if (!apiConfig) return null;
    
    try {
      const response = await fetch(apiConfig.endpoint, {
        method: apiConfig.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiConfig.headers,
        },
        body: JSON.stringify({ value, ...apiConfig.body }),
      });
      
      if (!response.ok) {
        throw new Error(`Validation API returned ${response.status}`);
      }
      
      const result = await response.json();
      return result.valid ? null : result.message || 'Validation failed';
    } catch (error) {
      return `API validation failed: ${error instanceof Error ? error.message : 'Network error'}`;
    }
  }
}

export const ValidationEngine: React.FC<ValidationEngineProps> = ({
  schema,
  onValidationChange
}) => {
  const { watch, formState: { errors }, trigger } = useFormContext();
  const [fieldValidations, setFieldValidations] = useState<Record<string, FieldValidation>>({});
  const [asyncQueue] = useState(() => new AsyncValidationQueue());
  const [showValidationPanel, setShowValidationPanel] = useState(false);

  // Watch all form values
  const formValues = watch();
  const debouncedValues = useDebounce(formValues, 300);

  // Create AJV validator
  const ajvValidator = useMemo(() => {
    const ajv = createAjvInstance();
    return ajv.compile(schema);
  }, [schema]);

  // Extract validation configurations from schema
  const validationConfigs = useMemo(() => {
    const configs: Record<string, ValidationConfig> = {};
    
    const extractConfigs = (properties: any, basePath = '') => {
      Object.entries(properties || {}).forEach(([key, fieldSchema]: [string, any]) => {
        const fullPath = basePath ? `${basePath}.${key}` : key;
        const formConfig = fieldSchema['x-form-config'] as FormConfiguration;
        
        if (formConfig?.validation) {
          configs[fullPath] = formConfig.validation;
        }
        
        // Recurse into nested objects
        if (fieldSchema.type === 'object' && fieldSchema.properties) {
          extractConfigs(fieldSchema.properties, fullPath);
        }
      });
    };
    
    extractConfigs(schema.properties);
    return configs;
  }, [schema]);

  // Perform field validation
  const validateField = useCallback(async (
    fieldPath: string,
    value: any,
    config: ValidationConfig
  ) => {
    const fieldValidation: FieldValidation = {
      isValid: true,
      isValidating: true,
      errors: [],
      warnings: [],
      infos: [],
      lastValidated: new Date(),
    };

    // Update state to show validating
    setFieldValidations(prev => ({
      ...prev,
      [fieldPath]: fieldValidation
    }));

    const errors: string[] = [];
    const warnings: string[] = [];
    const infos: string[] = [];

    // Custom validation
    if (config.customValidation) {
      const validator = CUSTOM_VALIDATORS[config.customValidation];
      if (validator) {
        const result = await validator(value, {} as ConfigurationSchema);
        if (result) {
          errors.push(result);
        }
      }
    }

    // Async validation (API or custom)
    if (config.async && (config.apiValidation || config.customValidation)) {
      asyncQueue.add(
        {
          fieldPath,
          value,
          config,
          timestamp: Date.now(),
        },
        (result) => {
          setFieldValidations(prev => ({
            ...prev,
            [fieldPath]: {
              ...prev[fieldPath],
              isValidating: false,
              errors: result ? [result] : [],
              isValid: !result,
            }
          }));
        }
      );
      
      return; // Async validation result will update state later
    }

    // Update final state
    const isValid = errors.length === 0;
    setFieldValidations(prev => ({
      ...prev,
      [fieldPath]: {
        ...fieldValidation,
        isValid,
        isValidating: false,
        errors,
        warnings,
        infos,
      }
    }));
  }, [asyncQueue]);

  // Validate all fields
  const validateAllFields = useCallback(async () => {
    // JSON Schema validation
    const isValidSchema = ajvValidator(debouncedValues);
    const schemaErrors: ValidationError[] = [];
    
    if (!isValidSchema && ajvValidator.errors) {
      ajvValidator.errors.forEach(error => {
        schemaErrors.push({
          field: error.instancePath.replace(/^\//, '').replace(/\//g, '.'),
          path: error.instancePath,
          message: error.message || 'Validation error',
          severity: 'error',
          code: error.keyword,
          data: error.data,
        });
      });
    }

    // Custom field validations
    const fieldValidationPromises = Object.entries(validationConfigs).map(
      ([fieldPath, config]) => {
        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], debouncedValues);
        return validateField(fieldPath, value, config);
      }
    );

    await Promise.all(fieldValidationPromises);

    // Compile overall validation result
    const allErrors: ValidationError[] = [...schemaErrors];
    const allWarnings: ValidationError[] = [];
    const allInfos: ValidationError[] = [];

    Object.entries(fieldValidations).forEach(([fieldPath, validation]) => {
      validation.errors.forEach(message => {
        allErrors.push({
          field: fieldPath,
          path: fieldPath,
          message,
          severity: 'error',
        });
      });
      
      validation.warnings.forEach(message => {
        allWarnings.push({
          field: fieldPath,
          path: fieldPath,
          message,
          severity: 'warning',
        });
      });
      
      validation.infos.forEach(message => {
        allInfos.push({
          field: fieldPath,
          path: fieldPath,
          message,
          severity: 'info',
        });
      });
    });

    const result: ValidationResult = {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      infos: allInfos,
      fieldValidations,
    };

    onValidationChange?.(result);
    
    return result;
  }, [debouncedValues, ajvValidator, validationConfigs, validateField, fieldValidations, onValidationChange]);

  // Re-validate when values change
  useEffect(() => {
    validateAllFields();
  }, [validateAllFields]);

  // Force re-validation
  const handleForceValidation = useCallback(async () => {
    await trigger();
    validateAllFields();
  }, [trigger, validateAllFields]);

  // Calculate summary
  const validationSummary = useMemo(() => {
    const totalErrors = Object.values(fieldValidations).reduce(
      (sum, validation) => sum + validation.errors.length,
      0
    );
    const totalWarnings = Object.values(fieldValidations).reduce(
      (sum, validation) => sum + validation.warnings.length,
      0
    );
    const validatingCount = Object.values(fieldValidations).filter(
      validation => validation.isValidating
    ).length;

    return { totalErrors, totalWarnings, validatingCount };
  }, [fieldValidations]);

  return (
    <div className="validation-engine">
      {/* Validation status indicator */}
      {(validationSummary.totalErrors > 0 || validationSummary.totalWarnings > 0 || validationSummary.validatingCount > 0) && (
        <Collapsible open={showValidationPanel} onOpenChange={setShowValidationPanel}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="mb-4 w-full justify-between"
            >
              <div className="flex items-center gap-2">
                {validationSummary.validatingCount > 0 && (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validating...</span>
                  </>
                )}
                
                {validationSummary.totalErrors > 0 && (
                  <>
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <Badge variant="destructive">{validationSummary.totalErrors}</Badge>
                  </>
                )}
                
                {validationSummary.totalWarnings > 0 && (
                  <>
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <Badge variant="secondary">{validationSummary.totalWarnings}</Badge>
                  </>
                )}
                
                {validationSummary.totalErrors === 0 && validationSummary.totalWarnings === 0 && validationSummary.validatingCount === 0 && (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>All valid</span>
                  </>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleForceValidation}
                className="h-6 w-6 p-0 ml-2"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
              {Object.entries(fieldValidations).map(([fieldPath, validation]) => (
                <div key={fieldPath}>
                  {validation.errors.map((error, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{fieldPath}:</span> {error}
                      </div>
                    </div>
                  ))}
                  
                  {validation.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-yellow-600">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{fieldPath}:</span> {warning}
                      </div>
                    </div>
                  ))}
                  
                  {validation.infos.map((info, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-blue-600">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{fieldPath}:</span> {info}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default ValidationEngine;