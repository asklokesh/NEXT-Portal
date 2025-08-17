'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, Save, RefreshCw, AlertTriangle, CheckCircle,
  Code, Eye, Copy, Download, Upload, Trash2, Plus,
  ChevronDown, ChevronRight, HelpCircle, ExternalLink,
  Lock, Unlock, Key, Database, Server, Cloud, 
  MousePointer, Move, Layers, Palette, Wand2, 
  Grid3X3, Layout, Maximize2, RotateCw, Zap,
  Target, GitBranch, Package, Globe, Shield, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JSONSchema7 } from 'json-schema';

interface ConfigurationSchema {
  $schema?: string;
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  definitions?: Record<string, any>;
}

interface PluginConfiguration {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  schema: ConfigurationSchema;
  values: Record<string, any>;
  environment: 'development' | 'staging' | 'production';
  version: string;
  lastModified: Date;
  validationErrors?: string[];
}

interface PluginConfigProps {
  pluginId: string;
  pluginName: string;
  onClose?: () => void;
  onSave?: (config: PluginConfiguration) => void;
}

export default function AdvancedPluginConfigurationManager({ 
  pluginId, 
  pluginName, 
  onClose, 
  onSave 
}: PluginConfigProps) {
  const [configurations, setConfigurations] = useState<PluginConfiguration[]>([]);
  const [activeConfig, setActiveConfig] = useState<PluginConfiguration | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'json' | 'visual'>('form');
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState(false);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [visualComponents, setVisualComponents] = useState<any[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [draggedComponent, setDraggedComponent] = useState<any>(null);

  useEffect(() => {
    fetchConfigurations();
  }, [pluginId, environment]);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/plugins/${pluginId}/configurations?environment=${environment}`);
      const data = await response.json();
      
      if (data.success) {
        setConfigurations(data.configurations);
        setTemplates(data.templates || {});
        
        // Set active config to the first one or create a new one
        if (data.configurations.length > 0) {
          const config = data.configurations[0];
          setActiveConfig(config);
          setConfigValues(config.values);
        } else {
          // Create default configuration
          const defaultConfig = await createDefaultConfiguration();
          setActiveConfig(defaultConfig);
          setConfigValues(defaultConfig.values);
        }
      }
    } catch (error) {
      console.error('Failed to fetch configurations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultConfiguration = async (): Promise<PluginConfiguration> => {
    // Fetch plugin schema
    const schemaResponse = await fetch(`/api/plugins/${pluginId}/schema`);
    const schemaData = await schemaResponse.json();
    
    return {
      id: `${pluginId}-${environment}-${Date.now()}`,
      pluginId,
      name: `${pluginName} Configuration`,
      description: `Configuration for ${pluginName} in ${environment} environment`,
      schema: schemaData.schema || { type: 'object', properties: {} },
      values: schemaData.defaultValues || {},
      environment,
      version: '1.0.0',
      lastModified: new Date(),
      validationErrors: []
    };
  };

  const validateConfiguration = useCallback((values: Record<string, any>, schema: ConfigurationSchema) => {
    const errors: Record<string, string> = {};
    
    if (schema.required) {
      schema.required.forEach(field => {
        if (!values[field] || values[field] === '') {
          errors[field] = `${field} is required`;
        }
      });
    }
    
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const value = values[key];
        if (value !== undefined && value !== null) {
          // Type validation
          if (propSchema.type === 'number' && isNaN(Number(value))) {
            errors[key] = `${key} must be a valid number`;
          }
          if (propSchema.type === 'integer' && (!Number.isInteger(Number(value)))) {
            errors[key] = `${key} must be an integer`;
          }
          if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
            errors[key] = `${key} must be a boolean`;
          }
          
          // Pattern validation
          if (propSchema.pattern && typeof value === 'string') {
            const regex = new RegExp(propSchema.pattern);
            if (!regex.test(value)) {
              errors[key] = propSchema.patternDescription || `${key} format is invalid`;
            }
          }
          
          // Range validation
          if (propSchema.minimum !== undefined && Number(value) < propSchema.minimum) {
            errors[key] = `${key} must be at least ${propSchema.minimum}`;
          }
          if (propSchema.maximum !== undefined && Number(value) > propSchema.maximum) {
            errors[key] = `${key} must be at most ${propSchema.maximum}`;
          }
        }
      });
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  const handleValueChange = (key: string, value: any) => {
    const newValues = { ...configValues, [key]: value };
    setConfigValues(newValues);
    
    if (activeConfig) {
      validateConfiguration(newValues, activeConfig.schema);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!activeConfig) return;
    
    const isValid = validateConfiguration(configValues, activeConfig.schema);
    if (!isValid) {
      return;
    }
    
    setSaving(true);
    try {
      const updatedConfig = {
        ...activeConfig,
        values: configValues,
        lastModified: new Date(),
        validationErrors: []
      };
      
      const response = await fetch(`/api/plugins/${pluginId}/configurations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configuration: updatedConfig,
          environment
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setActiveConfig(updatedConfig);
        onSave?.(updatedConfig);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderFormField = (key: string, schema: any, value: any) => {
    const hasError = validationErrors[key];
    const isRequired = activeConfig?.schema.required?.includes(key);
    
    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      hasError 
        ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
        : 'border-gray-300 dark:border-gray-600'
    }`;

    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return (
            <select
              value={value || ''}
              onChange={(e) => handleValueChange(key, e.target.value)}
              className={baseClasses}
            >
              <option value="">Select an option</option>
              {schema.enum.map((option: string) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          );
        }
        if (schema.format === 'textarea' || (schema.description && schema.description.includes('multiline'))) {
          return (
            <textarea
              value={value || ''}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder={schema.description}
              rows={4}
              className={baseClasses}
            />
          );
        }
        if (schema.format === 'password') {
          return (
            <input
              type="password"
              value={value || ''}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder={schema.description}
              className={baseClasses}
            />
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleValueChange(key, e.target.value)}
            placeholder={schema.description}
            className={baseClasses}
          />
        );
        
      case 'number':
      case 'integer':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleValueChange(key, e.target.value ? Number(e.target.value) : undefined)}
            min={schema.minimum}
            max={schema.maximum}
            step={schema.type === 'integer' ? 1 : 'any'}
            className={baseClasses}
          />
        );
        
      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleValueChange(key, e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {schema.description || key}
            </span>
          </label>
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
                    handleValueChange(key, newArray);
                  }}
                  className={baseClasses.replace('w-full', 'flex-1')}
                />
                <button
                  onClick={() => {
                    const newArray = arrayValue.filter((_: any, i: number) => i !== index);
                    handleValueChange(key, newArray);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => handleValueChange(key, [...arrayValue, ''])}
              className="flex items-center px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </button>
          </div>
        );
        
      default:
        return (
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '')}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleValueChange(key, parsed);
              } catch {
                handleValueChange(key, e.target.value);
              }
            }}
            rows={4}
            className={baseClasses}
          />
        );
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Configure {pluginName}
            </h2>
            <p className="text-blue-100">
              Advanced configuration management with schema validation
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="px-3 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-white"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg">
              <button
                onClick={() => setViewMode('form')}
                className={`px-4 py-2 flex items-center gap-2 ${viewMode === 'form' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'} rounded-l-lg`}
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Form</span>
              </button>
              <button
                onClick={() => setViewMode('visual')}
                className={`px-4 py-2 flex items-center gap-2 ${viewMode === 'visual' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}
              >
                <Palette className="w-4 h-4" />
                <span className="text-sm">Visual</span>
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`px-4 py-2 flex items-center gap-2 ${viewMode === 'json' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'} rounded-r-lg`}
              >
                <Code className="w-4 h-4" />
                <span className="text-sm">JSON</span>
              </button>
            </div>
            
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-4 py-2 border rounded-lg flex items-center ${
                previewMode ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveConfiguration}
              disabled={saving || Object.keys(validationErrors).length > 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="font-medium text-red-800 dark:text-red-200">Configuration Errors</span>
            </div>
            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
              {Object.entries(validationErrors).map(([field, error]) => (
                <li key={field}><strong>{field}:</strong> {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Configuration Form */}
        {viewMode === 'form' && activeConfig && (
          <div className="space-y-6">
            {activeConfig.schema.properties && 
             Object.entries(activeConfig.schema.properties).map(([key, schema]) => {
               const isRequired = activeConfig.schema.required?.includes(key);
               const hasError = validationErrors[key];
               const sectionId = `section-${key}`;
               const isExpanded = expandedSections.has(sectionId) || !schema.properties;

               return (
                 <motion.div
                   key={key}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                 >
                   {schema.properties ? (
                     // Collapsible section for complex objects
                     <div>
                       <button
                         onClick={() => toggleSection(sectionId)}
                         className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between"
                       >
                         <div className="flex items-center">
                           {isExpanded ? (
                             <ChevronDown className="w-4 h-4 mr-2" />
                           ) : (
                             <ChevronRight className="w-4 h-4 mr-2" />
                           )}
                           <span className="font-medium text-gray-900 dark:text-gray-100">
                             {key}
                           </span>
                           {isRequired && (
                             <span className="ml-2 text-red-500">*</span>
                           )}
                         </div>
                         {schema.description && (
                           <span className="text-sm text-gray-500 dark:text-gray-400">
                             {schema.description}
                           </span>
                         )}
                       </button>
                       
                       <AnimatePresence>
                         {isExpanded && (
                           <motion.div
                             initial={{ opacity: 0, height: 0 }}
                             animate={{ opacity: 1, height: 'auto' }}
                             exit={{ opacity: 0, height: 0 }}
                             className="p-4 space-y-4"
                           >
                             {Object.entries(schema.properties).map(([subKey, subSchema]) => (
                               <div key={subKey}>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                   {subKey}
                                   {schema.required?.includes(subKey) && (
                                     <span className="text-red-500 ml-1">*</span>
                                   )}
                                 </label>
                                 {renderFormField(`${key}.${subKey}`, subSchema, configValues[key]?.[subKey])}
                                 {subSchema.description && (
                                   <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                     {subSchema.description}
                                   </p>
                                 )}
                               </div>
                             ))}
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>
                   ) : (
                     // Simple field
                     <div className="p-4">
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                         {key}
                         {isRequired && <span className="text-red-500 ml-1">*</span>}
                         {schema.description && (
                           <div className="flex items-center mt-1">
                             <HelpCircle className="w-3 h-3 text-gray-400 mr-1" />
                             <span className="text-xs text-gray-500 dark:text-gray-400">
                               {schema.description}
                             </span>
                           </div>
                         )}
                       </label>
                       {renderFormField(key, schema, configValues[key])}
                       {hasError && (
                         <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                           {validationErrors[key]}
                         </p>
                       )}
                     </div>
                   )}
                 </motion.div>
               );
             })}
          </div>
        )}

        {/* Visual Configuration Builder */}
        {viewMode === 'visual' && activeConfig && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Visual Configuration Builder</h3>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                  <Wand2 className="w-4 h-4 mr-1" />
                  Auto-Arrange
                </button>
                <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                  <Grid3X3 className="w-4 h-4 mr-1" />
                  Grid
                </button>
                <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                  <Maximize2 className="w-4 h-4 mr-1" />
                  Fullscreen
                </button>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6 h-[600px]">
              {/* Component Palette */}
              <div className="col-span-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-y-auto">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Component Palette</h4>
                <div className="space-y-3">
                  {[
                    { type: 'database', label: 'Database Config', icon: Database, color: 'blue' },
                    { type: 'api', label: 'API Endpoint', icon: Globe, color: 'green' },
                    { type: 'auth', label: 'Authentication', icon: Shield, color: 'purple' },
                    { type: 'cache', label: 'Cache Settings', icon: Zap, color: 'yellow' },
                    { type: 'logging', label: 'Logging Config', icon: FileCheck2, color: 'indigo' },
                    { type: 'metrics', label: 'Metrics', icon: BarChart3, color: 'pink' },
                    { type: 'feature-flags', label: 'Feature Flags', icon: Target, color: 'orange' },
                    { type: 'secrets', label: 'Secrets', icon: Lock, color: 'red' }
                  ].map((component) => {
                    const IconComponent = component.icon;
                    return (
                      <motion.div
                        key={component.type}
                        draggable
                        onDragStart={() => setDraggedComponent(component)}
                        onDragEnd={() => setDraggedComponent(null)}
                        whileHover={{ scale: 1.02 }}
                        className={`p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-${component.color}-300 dark:border-${component.color}-600 cursor-grab active:cursor-grabbing transition-all hover:shadow-md`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-2 bg-${component.color}-100 dark:bg-${component.color}-900/20 rounded`}>
                            <IconComponent className={`h-4 w-4 text-${component.color}-600 dark:text-${component.color}-400`} />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {component.label}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Canvas */}
              <div 
                className="col-span-7 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 relative overflow-auto"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedComponent) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    const newComponent = {
                      id: `${draggedComponent.type}-${Date.now()}`,
                      type: draggedComponent.type,
                      label: draggedComponent.label,
                      icon: draggedComponent.icon,
                      color: draggedComponent.color,
                      x,
                      y,
                      config: {}
                    };
                    
                    setVisualComponents(prev => [...prev, newComponent]);
                    setDraggedComponent(null);
                  }
                }}
              >
                {visualComponents.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Layout className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Visual Configuration Canvas</p>
                      <p className="text-sm">Drag components from the palette to start building</p>
                    </div>
                  </div>
                ) : (
                  visualComponents.map((component) => {
                    const IconComponent = component.icon;
                    const isSelected = selectedComponent === component.id;
                    
                    return (
                      <motion.div
                        key={component.id}
                        style={{ left: component.x, top: component.y }}
                        className={`absolute w-48 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 cursor-move ${
                          isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-700'
                        }`}
                        onClick={() => setSelectedComponent(isSelected ? null : component.id)}
                        drag
                        dragMomentum={false}
                        onDrag={(e, info) => {
                          setVisualComponents(prev =>
                            prev.map(c =>
                              c.id === component.id
                                ? { ...c, x: info.point.x, y: info.point.y }
                                : c
                            )
                          );
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 bg-${component.color}-100 dark:bg-${component.color}-900/20 rounded`}>
                              <IconComponent className={`h-4 w-4 text-${component.color}-600 dark:text-${component.color}-400`} />
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {component.label}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisualComponents(prev => prev.filter(c => c.id !== component.id));
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500 mb-1">Configuration:</div>
                          {component.type === 'database' && (
                            <div className="space-y-1">
                              <input 
                                placeholder="Host" 
                                className="w-full text-xs p-1 border rounded" 
                                onClick={(e) => e.stopPropagation()}
                              />
                              <input 
                                placeholder="Port" 
                                className="w-full text-xs p-1 border rounded" 
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                          {component.type === 'api' && (
                            <input 
                              placeholder="API Endpoint URL" 
                              className="w-full text-xs p-1 border rounded" 
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          {component.type === 'auth' && (
                            <select className="w-full text-xs p-1 border rounded" onClick={(e) => e.stopPropagation()}>
                              <option>OAuth</option>
                              <option>SAML</option>
                              <option>OIDC</option>
                            </select>
                          )}
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Status:</span>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-600">Connected</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Properties Panel */}
              <div className="col-span-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Properties</h4>
                {selectedComponent ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Component Type</label>
                      <div className="mt-1 text-sm text-gray-900 dark:text-white">
                        {visualComponents.find(c => c.id === selectedComponent)?.type}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Label</label>
                      <input 
                        type="text" 
                        className="mt-1 w-full text-xs p-2 border rounded"
                        defaultValue={visualComponents.find(c => c.id === selectedComponent)?.label}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Position</label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <input 
                          type="number" 
                          placeholder="X"
                          className="text-xs p-1 border rounded"
                          value={Math.round(visualComponents.find(c => c.id === selectedComponent)?.x || 0)}
                          readOnly
                        />
                        <input 
                          type="number" 
                          placeholder="Y"
                          className="text-xs p-1 border rounded"
                          value={Math.round(visualComponents.find(c => c.id === selectedComponent)?.y || 0)}
                          readOnly
                        />
                      </div>
                    </div>
                    <button className="w-full px-3 py-2 bg-red-500 text-white text-xs rounded hover:bg-red-600 flex items-center justify-center gap-1">
                      <Trash2 className="h-3 w-3" />
                      Delete Component
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm">
                    <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Select a component to edit its properties
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* JSON View */}
        {viewMode === 'json' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Configuration JSON</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(configValues, null, 2))}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </button>
                <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </button>
                <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                  <Upload className="w-4 h-4 mr-1" />
                  Import
                </button>
              </div>
            </div>
            <textarea
              value={JSON.stringify(configValues, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setConfigValues(parsed);
                } catch (error) {
                  // Handle JSON parse error
                }
              }}
              className="w-full h-96 p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Configuration Preview */}
        {previewMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Configuration Preview</h3>
            <div className="bg-white dark:bg-gray-800 rounded border p-4">
              <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-auto">
                {JSON.stringify(configValues, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}