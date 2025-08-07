'use client';

import React, { useState, useEffect } from 'react';
import { 
 Save, 
 Eye, 
 EyeOff, 
 AlertCircle,
 CheckCircle,
 ExternalLink,
 Info,
 Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
 PluginConfigSchema, 
 PluginConfigField, 
 getPluginConfig, 
 validatePluginConfig 
} from '@/lib/plugins/plugin-configs';

interface PluginConfigurationFormProps {
 pluginId: string;
 onSave: (config: Record<string, any>) => Promise<void>;
 onCancel: () => void;
 initialConfig?: Record<string, any>;
}

export function PluginConfigurationForm({ 
 pluginId, 
 onSave, 
 onCancel, 
 initialConfig = {} 
}: PluginConfigurationFormProps) {
 const [schema, setSchema] = useState<PluginConfigSchema | null>(null);
 const [config, setConfig] = useState<Record<string, any>>(initialConfig);
 const [errors, setErrors] = useState<string[]>([]);
 const [saving, setSaving] = useState(false);
 const [showSensitiveFields, setShowSensitiveFields] = useState<Record<string, boolean>>({});

 useEffect(() => {
 const pluginSchema = getPluginConfig(pluginId);
 if (pluginSchema) {
 setSchema(pluginSchema);
 
 // Set default values
 const defaultConfig = { ...initialConfig };
 pluginSchema.sections.forEach(section => {
 section.fields.forEach(field => {
 if (field.defaultValue !== undefined && !defaultConfig[field.name]) {
 defaultConfig[field.name] = field.defaultValue;
 }
 });
 });
 setConfig(defaultConfig);
 }
 }, [pluginId, initialConfig]);

 const handleFieldChange = (fieldName: string, value: any) => {
 setConfig(prev => ({
 ...prev,
 [fieldName]: value
 }));
 
 // Clear errors when user starts typing
 if (errors.length > 0) {
 setErrors([]);
 }
 };

 const toggleSensitiveField = (fieldName: string) => {
 setShowSensitiveFields(prev => ({
 ...prev,
 [fieldName]: !prev[fieldName]
 }));
 };

 const handleSave = async () => {
 if (!schema) return;
 
 // Validate configuration
 const validation = validatePluginConfig(pluginId, config);
 if (!validation.isValid) {
 setErrors(validation.errors);
 toast.error('Please fix the validation errors');
 return;
 }
 
 setSaving(true);
 try {
 await onSave(config);
 toast.success(`${schema.pluginName} configured successfully`);
 } catch (error) {
 toast.error('Failed to save configuration');
 console.error('Save error:', error);
 } finally {
 setSaving(false);
 }
 };

 const renderField = (field: PluginConfigField) => {
 const value = config[field.name] || '';
 const isPassword = field.type === 'password' || field.sensitive;
 const showPassword = showSensitiveFields[field.name];

 switch (field.type) {
 case 'text':
 case 'url':
 case 'password':
 return (
 <div key={field.name} className=\"space-y-2\">
 <div className=\"flex items-center gap-2\">
 <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300\">
 {field.label}
 {field.required && <span className=\"text-red-500 ml-1\">*</span>}
 </label>
 {field.sensitive && (
 <Lock className=\"w-3 h-3 text-gray-400\" />
 )}
 </div>
 <div className=\"relative\">
 <input
 type={isPassword && !showPassword ? 'password' : 'text'}
 value={value}
 onChange={(e) => handleFieldChange(field.name, e.target.value)}
 placeholder={field.placeholder}
 className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
 />
 {isPassword && (
 <button
 type=\"button\"
 onClick={() => toggleSensitiveField(field.name)}
 className=\"absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600\"
 >
 {showPassword ? <EyeOff className=\"w-4 h-4\" /> : <Eye className=\"w-4 h-4\" />}
 </button>
 )}
 </div>
 {field.description && (
 <p className=\"text-xs text-gray-500 dark:text-gray-400\">{field.description}</p>
 )}
 </div>
 );

 case 'textarea':
 return (
 <div key={field.name} className=\"space-y-2\">
 <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300\">
 {field.label}
 {field.required && <span className=\"text-red-500 ml-1\">*</span>}
 </label>
 <textarea
 value={value}
 onChange={(e) => handleFieldChange(field.name, e.target.value)}
 placeholder={field.placeholder}
 rows={3}
 className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
 />
 {field.description && (
 <p className=\"text-xs text-gray-500 dark:text-gray-400\">{field.description}</p>
 )}
 </div>
 );

 case 'number':
 return (
 <div key={field.name} className=\"space-y-2\">
 <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300\">
 {field.label}
 {field.required && <span className=\"text-red-500 ml-1\">*</span>}
 </label>
 <input
 type=\"number\"
 value={value}
 onChange={(e) => handleFieldChange(field.name, Number(e.target.value))}
 placeholder={field.placeholder}
 min={field.validation?.min}
 max={field.validation?.max}
 className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
 />
 {field.description && (
 <p className=\"text-xs text-gray-500 dark:text-gray-400\">{field.description}</p>
 )}
 </div>
 );

 case 'boolean':
 return (
 <div key={field.name} className=\"flex items-center justify-between py-2\">
 <div>
 <label className=\"text-sm font-medium text-gray-700 dark:text-gray-300\">
 {field.label}
 </label>
 {field.description && (
 <p className=\"text-xs text-gray-500 dark:text-gray-400 mt-1\">{field.description}</p>
 )}
 </div>
 <button
 type=\"button\"
 onClick={() => handleFieldChange(field.name, !value)}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
 value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
 value ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 </div>
 );

 case 'select':
 return (
 <div key={field.name} className=\"space-y-2\">
 <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300\">
 {field.label}
 {field.required && <span className=\"text-red-500 ml-1\">*</span>}
 </label>
 <select
 value={value}
 onChange={(e) => handleFieldChange(field.name, e.target.value)}
 className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
 >
 <option value=\"\">Select an option...</option>
 {field.options?.map(option => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 {field.description && (
 <p className=\"text-xs text-gray-500 dark:text-gray-400\">{field.description}</p>
 )}
 </div>
 );

 case 'json':
 return (
 <div key={field.name} className=\"space-y-2\">
 <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300\">
 {field.label}
 {field.required && <span className=\"text-red-500 ml-1\">*</span>}
 </label>
 <textarea
 value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
 onChange={(e) => {
 try {
 const parsed = JSON.parse(e.target.value);
 handleFieldChange(field.name, parsed);
 } catch {
 handleFieldChange(field.name, e.target.value);
 }
 }}
 placeholder={field.placeholder || '{}'}
 rows={4}
 className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
 />
 {field.description && (
 <p className=\"text-xs text-gray-500 dark:text-gray-400\">{field.description}</p>
 )}
 </div>
 );

 default:
 return null;
 }
 };

 if (!schema) {
 return (
 <div className=\"flex items-center justify-center p-8\">
 <div className=\"text-center\">
 <AlertCircle className=\"w-12 h-12 text-yellow-500 mx-auto mb-4\" />
 <h3 className=\"text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2\">
 Configuration Not Available
 </h3>
 <p className=\"text-gray-600 dark:text-gray-400\">
 No configuration schema found for plugin: {pluginId}
 </p>
 </div>
 </div>
 );
 }

 return (
 <div className=\"max-w-4xl mx-auto p-6\">
 {/* Header */}
 <div className=\"mb-8\">
 <div className=\"flex items-center justify-between mb-4\">
 <h2 className=\"text-2xl font-bold text-gray-900 dark:text-gray-100\">
 Configure {schema.pluginName}
 </h2>
 <a
 href={schema.documentationUrl}
 target=\"_blank\"
 rel=\"noopener noreferrer\"
 className=\"inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400\"
 >
 <ExternalLink className=\"w-4 h-4\" />
 Documentation
 </a>
 </div>
 <p className=\"text-gray-600 dark:text-gray-400\">{schema.description}</p>
 
 {/* Version and environment info */}
 <div className=\"mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg\">
 <div className=\"flex items-start gap-3\">
 <Info className=\"w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5\" />
 <div className=\"text-sm text-blue-800 dark:text-blue-200\">
 <p className=\"font-medium mb-1\">Plugin Version: {schema.version}</p>
 {schema.environmentVariables && schema.environmentVariables.length > 0 && (
 <p>
 <strong>Environment Variables:</strong> {schema.environmentVariables.join(', ')}
 </p>
 )}
 {schema.requiredIntegrations && schema.requiredIntegrations.length > 0 && (
 <p className=\"mt-1\">
 <strong>Required Integrations:</strong> {schema.requiredIntegrations.join(', ')}
 </p>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Errors */}
 {errors.length > 0 && (
 <div className=\"mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800\">
 <div className=\"flex items-start gap-3\">
 <AlertCircle className=\"w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5\" />
 <div>
 <h3 className=\"text-sm font-medium text-red-800 dark:text-red-200 mb-2\">
 Please fix the following errors:
 </h3>
 <ul className=\"text-sm text-red-700 dark:text-red-300 space-y-1\">
 {errors.map((error, index) => (
 <li key={index}>• {error}</li>
 ))}
 </ul>
 </div>
 </div>
 </div>
 )}

 {/* Configuration Sections */}
 <div className=\"space-y-8\">
 {schema.sections.map((section, sectionIndex) => (
 <div key={sectionIndex} className=\"bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6\">
 <div className=\"mb-6\">
 <h3 className=\"text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2\">
 {section.title}
 </h3>
 <p className=\"text-sm text-gray-600 dark:text-gray-400\">
 {section.description}
 </p>
 </div>
 
 <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
 {section.fields.map(renderField)}
 </div>
 </div>
 ))}
 </div>

 {/* Actions */}
 <div className=\"flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700\">
 <button
 onClick={onCancel}
 disabled={saving}
 className=\"px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50\"
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={saving}
 className=\"inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50\"
 >
 {saving ? (
 <>
 <div className=\"w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin\" />
 Saving...
 </>
 ) : (
 <>
 <Save className=\"w-4 h-4\" />
 Save Configuration
 </>
 )}
 </button>
 </div>
 </div>
 );
}