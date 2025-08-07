'use client';

import React, { useState, useEffect } from 'react';
import { 
 Save, 
 Copy, 
 Download, 
 Upload,
 FileCode,
 Eye,
 EyeOff,
 AlertCircle,
 Check,
 Plus,
 Trash2,
 ChevronDown,
 ChevronRight
} from 'lucide-react';
import { pluginBridge } from '@/lib/backstage/plugin-bridge';
import { toast } from 'react-hot-toast';
import type { Entity } from '@backstage/catalog-model';

interface EntityEditorProps {
 entity?: Entity;
 onSave: (entity: Entity) => Promise<void>;
 onCancel?: () => void;
 mode?: 'create' | 'edit';
}

export const EntityEditor: React.FC<EntityEditorProps> = ({ 
 entity, 
 onSave, 
 onCancel,
 mode = 'create' 
}) => {
 const [formData, setFormData] = useState<any>({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 name: '',
 namespace: 'default',
 title: '',
 description: '',
 type: 'service',
 lifecycle: 'production',
 owner: '',
 system: '',
 tags: [],
 labels: [],
 annotations: [],
 providesApis: [],
 consumesApis: [],
 dependsOn: [],
 });

 const [yamlMode, setYamlMode] = useState(false);
 const [yamlContent, setYamlContent] = useState('');
 const [errors, setErrors] = useState<string[]>([]);
 const [expandedSections, setExpandedSections] = useState({
 basic: true,
 metadata: true,
 spec: true,
 relations: false,
 advanced: false,
 });

 useEffect(() => {
 if (entity) {
 const transformed = pluginBridge.transformFromBackstageEntity(entity);
 setFormData(transformed);
 setYamlContent(pluginBridge.generateYAML(entity));
 }
 }, [entity]);

 const handleInputChange = (field: string, value: any) => {
 setFormData((prev: any) => ({
 ...prev,
 [field]: value,
 }));
 setErrors([]);
 };

 const handleArrayAdd = (field: string, value: string) => {
 if (!value.trim()) return;
 setFormData((prev: any) => ({
 ...prev,
 [field]: [...(prev[field] || []), value],
 }));
 };

 const handleArrayRemove = (field: string, index: number) => {
 setFormData((prev: any) => ({
 ...prev,
 [field]: prev[field].filter((_: any, i: number) => i !== index),
 }));
 };

 const handleLabelAdd = () => {
 setFormData((prev: any) => ({
 ...prev,
 labels: [...prev.labels, { key: '', value: '' }],
 }));
 };

 const handleLabelChange = (index: number, field: 'key' | 'value', value: string) => {
 const newLabels = [...formData.labels];
 newLabels[index][field] = value;
 setFormData((prev: any) => ({ ...prev, labels: newLabels }));
 };

 const handleLabelRemove = (index: number) => {
 setFormData((prev: any) => ({
 ...prev,
 labels: prev.labels.filter((_: any, i: number) => i !== index),
 }));
 };

 const toggleSection = (section: string) => {
 setExpandedSections(prev => ({
 ...prev,
 [section]: !prev[section],
 }));
 };

 const switchToYamlMode = () => {
 const entity = pluginBridge.transformToBackstageEntity(formData);
 setYamlContent(pluginBridge.generateYAML(entity));
 setYamlMode(true);
 };

 const switchToFormMode = () => {
 const entity = pluginBridge.parseYAML(yamlContent);
 if (entity) {
 const transformed = pluginBridge.transformFromBackstageEntity(entity);
 setFormData(transformed);
 setYamlMode(false);
 setErrors([]);
 } else {
 toast.error('Invalid YAML format');
 }
 };

 const validateAndSave = async () => {
 try {
 let entityToSave: Entity;
 
 if (yamlMode) {
 const parsed = pluginBridge.parseYAML(yamlContent);
 if (!parsed) {
 setErrors(['Invalid YAML format']);
 return;
 }
 entityToSave = parsed;
 } else {
 entityToSave = pluginBridge.transformToBackstageEntity(formData);
 }

 const validation = pluginBridge.validateEntity(entityToSave);
 if (!validation.valid) {
 setErrors(validation.errors);
 return;
 }

 await onSave(entityToSave);
 toast.success(`Entity ${mode === 'create' ? 'created' : 'updated'} successfully`);
 } catch (error) {
 console.error('Failed to save entity:', error);
 toast.error('Failed to save entity');
 }
 };

 const downloadYaml = () => {
 const entity = yamlMode 
 ? pluginBridge.parseYAML(yamlContent)
 : pluginBridge.transformToBackstageEntity(formData);
 
 if (!entity) {
 toast.error('Invalid entity data');
 return;
 }

 const yaml = pluginBridge.generateYAML(entity);
 const blob = new Blob([yaml], { type: 'text/yaml' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'catalog-info.yaml';
 a.click();
 URL.revokeObjectURL(url);
 };

 const copyYaml = () => {
 const entity = yamlMode 
 ? pluginBridge.parseYAML(yamlContent)
 : pluginBridge.transformToBackstageEntity(formData);
 
 if (!entity) {
 toast.error('Invalid entity data');
 return;
 }

 const yaml = pluginBridge.generateYAML(entity);
 navigator.clipboard.writeText(yaml);
 toast.success('YAML copied to clipboard');
 };

 const kinds = ['Component', 'API', 'System', 'Domain', 'Resource', 'Location', 'Template'];
 const componentTypes = ['service', 'website', 'library', 'documentation', 'tool'];
 const lifecycles = ['experimental', 'production', 'deprecated'];

 return (
 <div className="max-w-4xl mx-auto p-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
 {/* Header */}
 <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 {mode === 'create' ? 'Create New Entity' : 'Edit Entity'}
 </h2>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setYamlMode(!yamlMode)}
 className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
 >
 {yamlMode ? (
 <>
 <Eye className="w-4 h-4 mr-2" />
 Form View
 </>
 ) : (
 <>
 <FileCode className="w-4 h-4 mr-2" />
 YAML View
 </>
 )}
 </button>
 <button
 onClick={copyYaml}
 className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
 title="Copy YAML"
 >
 <Copy className="w-4 h-4" />
 </button>
 <button
 onClick={downloadYaml}
 className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
 title="Download YAML"
 >
 <Download className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>

 {/* Errors */}
 {errors.length > 0 && (
 <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
 <div className="flex">
 <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
 <div>
 <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
 Validation Errors
 </h3>
 <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
 {errors.map((error, i) => (
 <li key={i}>{error}</li>
 ))}
 </ul>
 </div>
 </div>
 </div>
 )}

 {/* Content */}
 <div className="p-6">
 {yamlMode ? (
 // YAML Editor
 <div className="space-y-4">
 <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
 Edit the YAML directly. The editor will validate your changes.
 </div>
 <textarea
 value={yamlContent}
 onChange={(e) => setYamlContent(e.target.value)}
 className="w-full h-96 px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 spellCheck={false}
 />
 </div>
 ) : (
 // Form Editor
 <div className="space-y-6">
 {/* Basic Information */}
 <div>
 <button
 onClick={() => toggleSection('basic')}
 className="flex items-center w-full text-left"
 >
 {expandedSections.basic ? (
 <ChevronDown className="w-4 h-4 mr-2" />
 ) : (
 <ChevronRight className="w-4 h-4 mr-2" />
 )}
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Basic Information
 </h3>
 </button>
 
 {expandedSections.basic && (
 <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Kind <span className="text-red-500">*</span>
 </label>
 <select
 value={formData.kind}
 onChange={(e) => handleInputChange('kind', e.target.value)}
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 {kinds.map(kind => (
 <option key={kind} value={kind}>{kind}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => handleInputChange('name', e.target.value)}
 placeholder="my-service"
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 <p className="mt-1 text-xs text-gray-500">
 Must contain only lowercase letters, numbers, and hyphens
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Namespace
 </label>
 <input
 type="text"
 value={formData.namespace}
 onChange={(e) => handleInputChange('namespace', e.target.value)}
 placeholder="default"
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Title
 </label>
 <input
 type="text"
 value={formData.title}
 onChange={(e) => handleInputChange('title', e.target.value)}
 placeholder="My Service"
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div className="sm:col-span-2">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Description
 </label>
 <textarea
 value={formData.description}
 onChange={(e) => handleInputChange('description', e.target.value)}
 rows={3}
 placeholder="A brief description of this entity..."
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </div>
 )}
 </div>

 {/* Spec */}
 {formData.kind === 'Component' && (
 <div>
 <button
 onClick={() => toggleSection('spec')}
 className="flex items-center w-full text-left"
 >
 {expandedSections.spec ? (
 <ChevronDown className="w-4 h-4 mr-2" />
 ) : (
 <ChevronRight className="w-4 h-4 mr-2" />
 )}
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Component Specification
 </h3>
 </button>
 
 {expandedSections.spec && (
 <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Type
 </label>
 <select
 value={formData.type}
 onChange={(e) => handleInputChange('type', e.target.value)}
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 {componentTypes.map(type => (
 <option key={type} value={type}>{type}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Lifecycle
 </label>
 <select
 value={formData.lifecycle}
 onChange={(e) => handleInputChange('lifecycle', e.target.value)}
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 {lifecycles.map(lifecycle => (
 <option key={lifecycle} value={lifecycle}>{lifecycle}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Owner <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={formData.owner}
 onChange={(e) => handleInputChange('owner', e.target.value)}
 placeholder="team-a"
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 System
 </label>
 <input
 type="text"
 value={formData.system}
 onChange={(e) => handleInputChange('system', e.target.value)}
 placeholder="my-system"
 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </div>
 )}
 </div>
 )}

 {/* Metadata */}
 <div>
 <button
 onClick={() => toggleSection('metadata')}
 className="flex items-center w-full text-left"
 >
 {expandedSections.metadata ? (
 <ChevronDown className="w-4 h-4 mr-2" />
 ) : (
 <ChevronRight className="w-4 h-4 mr-2" />
 )}
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Metadata
 </h3>
 </button>
 
 {expandedSections.metadata && (
 <div className="mt-4 space-y-4">
 {/* Tags */}
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Tags
 </label>
 <div className="flex gap-2 mb-2">
 <input
 type="text"
 placeholder="Add a tag"
 onKeyPress={(e) => {
 if (e.key === 'Enter') {
 handleArrayAdd('tags', (e.target as HTMLInputElement).value);
 (e.target as HTMLInputElement).value = '';
 }
 }}
 className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 <div className="flex flex-wrap gap-2">
 {formData.tags.map((tag: string, i: number) => (
 <span
 key={i}
 className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
 >
 {tag}
 <button
 onClick={() => handleArrayRemove('tags', i)}
 className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </span>
 ))}
 </div>
 </div>

 {/* Labels */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
 Labels
 </label>
 <button
 onClick={handleLabelAdd}
 className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
 >
 <Plus className="w-4 h-4" />
 </button>
 </div>
 <div className="space-y-2">
 {formData.labels.map((label: any, i: number) => (
 <div key={i} className="flex gap-2">
 <input
 type="text"
 value={label.key}
 onChange={(e) => handleLabelChange(i, 'key', e.target.value)}
 placeholder="Key"
 className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 <input
 type="text"
 value={label.value}
 onChange={(e) => handleLabelChange(i, 'value', e.target.value)}
 placeholder="Value"
 className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 <button
 onClick={() => handleLabelRemove(i)}
 className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
 {onCancel && (
 <button
 onClick={onCancel}
 className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
 >
 Cancel
 </button>
 )}
 {yamlMode && (
 <button
 onClick={switchToFormMode}
 className="px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
 >
 Switch to Form
 </button>
 )}
 {!yamlMode && (
 <button
 onClick={switchToYamlMode}
 className="px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
 >
 Switch to YAML
 </button>
 )}
 <button
 onClick={validateAndSave}
 className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <Save className="w-4 h-4 mr-2" />
 {mode === 'create' ? 'Create Entity' : 'Save Changes'}
 </button>
 </div>
 </div>
 </div>
 );
};