'use client';

/**
 * No-Code Configuration Manager
 * 
 * Dynamically generates configuration forms from plugin schemas
 * Provides visual, drag-and-drop configuration experience like Spotify Portal
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Save,
  RotateCcw,
  Eye,
  Code,
  Download,
  Upload,
  Copy,
  Check,
  AlertCircle,
  Info,
  Zap,
  Wrench,
  Puzzle,
  Database,
  Shield,
  Globe,
  Terminal,
  GitBranch,
  Layers,
  Monitor,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Move,
  Trash2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

// Configuration Schema Types
interface ConfigField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: Array<{ value: string; label: string }>;
  validation?: z.ZodSchema;
  dependencies?: string[];
  condition?: (config: any) => boolean;
  category?: string;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  pattern?: string;
  example?: any;
}

interface ConfigSection {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fields: ConfigField[];
  collapsed?: boolean;
  advanced?: boolean;
}

interface PluginSchema {
  id: string;
  name: string;
  title: string;
  version: string;
  sections: ConfigSection[];
  examples: Record<string, any>;
  documentation: string;
  requirements: string[];
}

interface NoCodeConfigurationManagerProps {
  pluginId: string;
  onSave: (config: any) => Promise<void>;
  onCancel: () => void;
  initialConfig?: any;
}

export function NoCodeConfigurationManager({
  pluginId,
  onSave,
  onCancel,
  initialConfig = {}
}: NoCodeConfigurationManagerProps) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<any>(initialConfig);
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [previewConfig, setPreviewConfig] = useState<string>('');

  // Fetch plugin schema
  const { data: schema, isLoading } = useQuery({
    queryKey: ['plugin-schema', pluginId],
    queryFn: async () => {
      const response = await fetch(`/api/plugins/${pluginId}/schema`);
      if (!response.ok) {
        throw new Error('Failed to fetch plugin schema');
      }
      return response.json() as PluginSchema;
    }
  });

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (configData: any) => {
      await onSave(configData);
    },
    onSuccess: () => {
      toast.success('Configuration saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['plugin-config', pluginId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to save configuration: ${error.message}`);
    }
  });

  // Update preview when config changes
  useEffect(() => {
    setPreviewConfig(JSON.stringify(config, null, 2));
  }, [config]);

  // Initialize expanded sections
  useEffect(() => {
    if (schema) {
      const basicSections = schema.sections
        .filter(section => !section.advanced)
        .map(section => section.id);
      setExpandedSections(new Set(basicSections));
    }
  }, [schema]);

  const handleFieldChange = useCallback((key: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      
      // Handle nested keys (e.g., "database.host")
      const keys = key.split('.');
      let current = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      return newConfig;
    });

    // Clear validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  const validateConfiguration = (): boolean => {
    if (!schema) return false;

    const errors: Record<string, string> = {};
    
    for (const section of schema.sections) {
      for (const field of section.fields) {
        const value = getFieldValue(field.key);
        
        // Required field validation
        if (field.required && (value === undefined || value === null || value === '')) {
          errors[field.key] = `${field.label} is required`;
          continue;
        }
        
        // Type validation
        if (value !== undefined && value !== null && value !== '') {
          try {
            if (field.validation) {
              field.validation.parse(value);
            } else {
              // Basic type validation
              switch (field.type) {
                case 'number':
                  if (isNaN(Number(value))) {
                    errors[field.key] = `${field.label} must be a number`;
                  }
                  break;
                case 'boolean':
                  if (typeof value !== 'boolean') {
                    errors[field.key] = `${field.label} must be true or false`;
                  }
                  break;
                case 'array':
                  if (!Array.isArray(value)) {
                    errors[field.key] = `${field.label} must be an array`;
                  }
                  break;
              }
            }
          } catch (error) {
            if (error instanceof z.ZodError) {
              errors[field.key] = error.errors[0]?.message || 'Invalid value';
            }
          }
        }
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getFieldValue = (key: string): any => {
    const keys = key.split('.');
    let current = config;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    
    return current;
  };

  const handleSave = async () => {
    if (!validateConfiguration()) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    try {
      await saveMutation.mutateAsync(config);
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleReset = () => {
    setConfig(initialConfig);
    setValidationErrors({});
    toast.info('Configuration reset to initial values');
  };

  const loadExample = (exampleKey: string) => {
    if (schema?.examples[exampleKey]) {
      setConfig(schema.examples[exampleKey]);
      toast.success(`Loaded ${exampleKey} example configuration`);
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pluginId}-config.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedConfig = JSON.parse(e.target?.result as string);
            setConfig(importedConfig);
            toast.success('Configuration imported successfully');
          } catch (error) {
            toast.error('Invalid JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const renderField = (field: ConfigField) => {
    const value = getFieldValue(field.key);
    const error = validationErrors[field.key];
    const isVisible = !field.condition || field.condition(config);
    
    if (!isVisible) return null;

    const fieldId = `field-${field.key}`;
    
    return (
      <div key={field.key} className="space-y-2">
        <label 
          htmlFor={fieldId}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {field.sensitive && <Shield className="w-4 h-4 text-yellow-500" />}
          {field.description && (
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {field.description}
              </div>
            </div>
          )}
        </label>
        
        <div className="space-y-1">
          {renderFieldInput(field, value, fieldId)}
          
          {error && (
            <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {field.example && !error && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Example: {JSON.stringify(field.example)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFieldInput = (field: ConfigField, value: any, fieldId: string) => {
    const commonProps = {
      id: fieldId,
      className: `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
        validationErrors[field.key] ? 'border-red-500' : ''
      }`,
      placeholder: field.placeholder,
      onChange: (e: any) => handleFieldChange(field.key, e.target.value)
    };

    switch (field.type) {
      case 'string':
        return field.sensitive ? (
          <input
            {...commonProps}
            type="password"
            value={value || ''}
          />
        ) : (
          <input
            {...commonProps}
            type="text"
            value={value || ''}
            pattern={field.pattern}
          />
        );

      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            value={value || ''}
            min={field.min}
            max={field.max}
            onChange={(e) => handleFieldChange(field.key, Number(e.target.value))}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input
              id={fieldId}
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor={fieldId} className="text-sm text-gray-600 dark:text-gray-400">
              {field.description || 'Enable this option'}
            </label>
          </div>
        );

      case 'select':
        return (
          <select
            {...commonProps}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          >
            <option value="">Select an option</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {field.options?.map(option => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(value || []).includes(option.value)}
                  onChange={(e) => {
                    const currentValues = value || [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v: any) => v !== option.value);
                    handleFieldChange(field.key, newValues);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        );

      case 'array':
        const arrayValue = value || [];
        return (
          <div className="space-y-2">
            {arrayValue.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newArray = [...arrayValue];
                    newArray[index] = e.target.value;
                    handleFieldChange(field.key, newArray);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={() => {
                    const newArray = arrayValue.filter((_: any, i: number) => i !== index);
                    handleFieldChange(field.key, newArray);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                handleFieldChange(field.key, [...arrayValue, '']);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          </div>
        );

      case 'object':
        return (
          <textarea
            {...commonProps}
            rows={4}
            value={JSON.stringify(value || {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(field.key, parsed);
              } catch {
                // Invalid JSON, keep the text value for editing
              }
            }}
            className="font-mono text-sm"
          />
        );

      default:
        return (
          <input
            {...commonProps}
            type="text"
            value={value || ''}
          />
        );
    }
  };

  const renderSection = (section: ConfigSection) => {
    const isExpanded = expandedSections.has(section.id);
    const hasVisibleFields = section.fields.some(field => 
      !field.condition || field.condition(config)
    );
    
    if (!hasVisibleFields && section.advanced && !showAdvanced) {
      return null;
    }

    const Icon = section.icon;

    return (
      <div key={section.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <button
          onClick={() => {
            const newExpanded = new Set(expandedSections);
            if (isExpanded) {
              newExpanded.delete(section.id);
            } else {
              newExpanded.add(section.id);
            }
            setExpandedSections(newExpanded);
          }}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-lg"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {section.title}
                {section.advanced && (
                  <span className="ml-2 px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded">
                    Advanced
                  </span>
                )}
              </h3>
              {section.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {section.description}
                </p>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {isExpanded && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {section.fields.map(renderField)}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Settings className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading configuration schema...</p>
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Schema not found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Unable to load configuration schema for this plugin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Configure {schema.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Version {schema.version} • No-code configuration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'visual' ? 'code' : 'visual')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {viewMode === 'visual' ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {viewMode === 'visual' ? 'Code View' : 'Visual View'}
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                showAdvanced
                  ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                  : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Advanced
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={exportConfig}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={importConfig}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            {schema.examples && Object.keys(schema.examples).length > 0 && (
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Sparkles className="w-4 h-4" />
                  Examples
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {Object.keys(schema.examples).map(exampleKey => (
                    <button
                      key={exampleKey}
                      onClick={() => loadExample(exampleKey)}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {exampleKey}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Content */}
      {viewMode === 'visual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Sections */}
          <div className="lg:col-span-2 space-y-4">
            {schema.sections.map(renderSection)}
          </div>
          
          {/* Preview Panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Configuration Preview
              </h3>
              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-auto max-h-96 font-mono">
                {previewConfig}
              </pre>
            </div>
            
            {schema.documentation && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Documentation
                </h3>
                <a
                  href={schema.documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  View plugin documentation →
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Configuration JSON
            </h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(previewConfig);
                toast.success('Configuration copied to clipboard');
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
          <textarea
            value={previewConfig}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setConfig(parsed);
                setPreviewConfig(e.target.value);
              } catch {
                setPreviewConfig(e.target.value);
              }
            }}
            className="w-full h-96 p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

export default NoCodeConfigurationManager;