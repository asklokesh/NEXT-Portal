'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle, Info, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { pluginRegistry } from '@/services/backstage/plugin-registry';
import { toast } from 'react-hot-toast';

interface PluginConfigurationModalProps {
 pluginId: string;
 onClose: () => void;
 onSave: (config: any) => Promise<void>;
}

export function PluginConfigurationModal({ pluginId, onClose, onSave }: PluginConfigurationModalProps) {
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [schema, setSchema] = useState<any>(null);
 const [formData, setFormData] = useState<Record<string, any>>({});
 const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
 const [errors, setErrors] = useState<Record<string, string>>({});

 useEffect(() => {
 loadConfigSchema();
 }, [pluginId]);

 const loadConfigSchema = async () => {
 try {
 setLoading(true);
 const configSchema = await pluginRegistry.getPluginConfigSchema(pluginId);
 setSchema(configSchema);
 
 // Initialize form data with defaults
 if (configSchema?.properties) {
 const initialData: Record<string, any> = {};
 Object.entries(configSchema.properties).forEach(([key, prop]: [string, any]) => {
 initialData[key] = prop.default || '';
 });
 setFormData(initialData);
 }
 } catch (error) {
 console.error('Failed to load config schema:', error);
 toast.error('Failed to load configuration schema');
 } finally {
 setLoading(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 // Validate required fields
 const newErrors: Record<string, string> = {};
 if (schema?.required) {
 schema.required.forEach((field: string) => {
 if (!formData[field]) {
 newErrors[field] = 'This field is required';
 }
 });
 }

 if (Object.keys(newErrors).length > 0) {
 setErrors(newErrors);
 return;
 }

 setSaving(true);
 try {
 await onSave({
 config: formData,
 enabled: true
 });
 } catch (error) {
 console.error('Failed to save configuration:', error);
 toast.error('Failed to save configuration');
 } finally {
 setSaving(false);
 }
 };

 const handleInputChange = (key: string, value: any) => {
 setFormData(prev => ({ ...prev, [key]: value }));
 // Clear error for this field
 if (errors[key]) {
 setErrors(prev => {
 const updated = { ...prev };
 delete updated[key];
 return updated;
 });
 }
 };

 const renderField = (key: string, property: any) => {
 const value = formData[key] || '';
 const error = errors[key];
 const isSecret = property.format === 'password';

 switch (property.type) {
 case 'string':
 if (property.enum) {
 return (
 <div key={key} className="mb-4">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {property.title || key}
 {schema?.required?.includes(key) && <span className="text-red-500 ml-1">*</span>}
 </label>
 <select
 value={value}
 onChange={(e) => handleInputChange(key, e.target.value)}
 className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 >
 <option value="">Select {property.title || key}</option>
 {property.enum.map((option: string) => (
 <option key={option} value={option}>{option}</option>
 ))}
 </select>
 {property.description && (
 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
 )}
 {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
 </div>
 );
 }

 if (isSecret) {
 return (
 <div key={key} className="mb-4">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {property.title || key}
 {schema?.required?.includes(key) && <span className="text-red-500 ml-1">*</span>}
 </label>
 <div className="relative">
 <input
 type={showSecrets[key] ? 'text' : 'password'}
 value={value}
 onChange={(e) => handleInputChange(key, e.target.value)}
 placeholder={property.placeholder || `Enter ${property.title || key}`}
 className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 <button
 type="button"
 onClick={() => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))}
 className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 >
 {showSecrets[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 {property.description && (
 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
 )}
 {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
 </div>
 );
 }

 return (
 <div key={key} className="mb-4">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {property.title || key}
 {schema?.required?.includes(key) && <span className="text-red-500 ml-1">*</span>}
 </label>
 <input
 type="text"
 value={value}
 onChange={(e) => handleInputChange(key, e.target.value)}
 placeholder={property.placeholder || `Enter ${property.title || key}`}
 className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 {property.description && (
 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
 )}
 {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
 </div>
 );

 case 'number':
 return (
 <div key={key} className="mb-4">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {property.title || key}
 {schema?.required?.includes(key) && <span className="text-red-500 ml-1">*</span>}
 </label>
 <input
 type="number"
 value={value}
 onChange={(e) => handleInputChange(key, e.target.valueAsNumber)}
 placeholder={property.placeholder || `Enter ${property.title || key}`}
 min={property.minimum}
 max={property.maximum}
 className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 {property.description && (
 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
 )}
 {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
 </div>
 );

 case 'boolean':
 return (
 <div key={key} className="mb-4">
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={value === true}
 onChange={(e) => handleInputChange(key, e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
 />
 <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
 {property.title || key}
 </span>
 </label>
 {property.description && (
 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">{property.description}</p>
 )}
 </div>
 );

 case 'array':
 return (
 <div key={key} className="mb-4">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {property.title || key}
 {schema?.required?.includes(key) && <span className="text-red-500 ml-1">*</span>}
 </label>
 <div className="space-y-2">
 {(value || []).map((item: string, index: number) => (
 <div key={index} className="flex gap-2">
 <input
 type="text"
 value={item}
 onChange={(e) => {
 const updated = [...(value || [])];
 updated[index] = e.target.value;
 handleInputChange(key, updated);
 }}
 className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 <button
 type="button"
 onClick={() => {
 const updated = (value || []).filter((_: any, i: number) => i !== index);
 handleInputChange(key, updated);
 }}
 className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 ))}
 <button
 type="button"
 onClick={() => handleInputChange(key, [...(value || []), ''])}
 className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
 >
 <Plus className="w-4 h-4 mr-1" />
 Add Item
 </button>
 </div>
 {property.description && (
 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
 )}
 {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
 </div>
 );

 default:
 return null;
 }
 };

 return (
 <div className="fixed inset-0 z-50 overflow-y-auto">
 <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
 {/* Background overlay */}
 <div className="fixed inset-0 transition-opacity" onClick={onClose}>
 <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
 </div>

 {/* Modal */}
 <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
 {/* Header */}
 <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold text-white">
 Configure Plugin: {pluginId}
 </h3>
 <button
 onClick={onClose}
 className="text-white hover:text-blue-100 transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* Content */}
 <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
 </div>
 ) : schema ? (
 <form onSubmit={handleSubmit}>
 {/* Info Banner */}
 <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
 <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
 <div className="text-sm text-blue-700 dark:text-blue-300">
 Configure this plugin to integrate with your Backstage instance. All fields marked with * are required.
 </div>
 </div>

 {/* Form Fields */}
 {schema.properties && Object.entries(schema.properties).map(([key, property]) =>
 renderField(key, property)
 )}

 {/* No configuration needed */}
 {(!schema.properties || Object.keys(schema.properties).length === 0) && (
 <div className="text-center py-8">
 <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
 <p className="text-gray-600 dark:text-gray-400">
 This plugin doesn't require any configuration.
 </p>
 </div>
 )}
 </form>
 ) : (
 <div className="text-center py-8">
 <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
 <p className="text-gray-600 dark:text-gray-400">
 Failed to load configuration schema
 </p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end gap-3">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 disabled={saving || loading}
 className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {saving ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
 <>
 <Save className="w-4 h-4 mr-2" />
 Save Configuration
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}