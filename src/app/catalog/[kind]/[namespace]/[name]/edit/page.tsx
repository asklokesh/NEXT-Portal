'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
 Save,
 X,
 AlertCircle,
 Plus,
 Trash2,
 ChevronDown,
 ChevronRight,
 FileCode,
 Eye,
 Copy,
 Check,
 Info,
 Link2,
 Users,
 Tag,
 Calendar,
 GitBranch,
 Shield,
 Package
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import yaml from 'js-yaml';

interface EntityField {
 name: string;
 type: 'string' | 'number' | 'boolean' | 'array' | 'object';
 required: boolean;
 description: string;
 example?: any;
 enum?: string[];
 pattern?: string;
}

interface EntitySchema {
 apiVersion: string;
 kind: string;
 fields: {
 metadata: EntityField[];
 spec: EntityField[];
 };
}

// Backstage core entity schemas
const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
 Component: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 fields: {
 metadata: [
 { name: 'name', type: 'string', required: true, description: 'Unique name of the component', pattern: '^[a-z0-9-]+$' },
 { name: 'namespace', type: 'string', required: false, description: 'Namespace for the component', pattern: '^[a-z0-9-]+$' },
 { name: 'title', type: 'string', required: false, description: 'Human-readable title' },
 { name: 'description', type: 'string', required: false, description: 'A brief description' },
 { name: 'labels', type: 'object', required: false, description: 'Key-value pairs for labeling' },
 { name: 'annotations', type: 'object', required: false, description: 'Key-value pairs for annotations' },
 { name: 'tags', type: 'array', required: false, description: 'Tags for categorization' },
 { name: 'links', type: 'array', required: false, description: 'External links related to the entity' }
 ],
 spec: [
 { name: 'type', type: 'string', required: true, description: 'The type of component', enum: ['service', 'website', 'library', 'documentation', 'tool', 'other'] },
 { name: 'lifecycle', type: 'string', required: true, description: 'The lifecycle phase', enum: ['experimental', 'production', 'deprecated'] },
 { name: 'owner', type: 'string', required: true, description: 'The team or user that owns this component' },
 { name: 'system', type: 'string', required: false, description: 'The system this component belongs to' },
 { name: 'subcomponentOf', type: 'string', required: false, description: 'Parent component reference' },
 { name: 'providesApis', type: 'array', required: false, description: 'APIs provided by this component' },
 { name: 'consumesApis', type: 'array', required: false, description: 'APIs consumed by this component' },
 { name: 'dependsOn', type: 'array', required: false, description: 'Components or resources this depends on' }
 ]
 }
 },
 System: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'System',
 fields: {
 metadata: [
 { name: 'name', type: 'string', required: true, description: 'Unique name of the system', pattern: '^[a-z0-9-]+$' },
 { name: 'namespace', type: 'string', required: false, description: 'Namespace for the system' },
 { name: 'title', type: 'string', required: false, description: 'Human-readable title' },
 { name: 'description', type: 'string', required: false, description: 'A brief description' },
 { name: 'tags', type: 'array', required: false, description: 'Tags for categorization' }
 ],
 spec: [
 { name: 'owner', type: 'string', required: true, description: 'The team or user that owns this system' },
 { name: 'domain', type: 'string', required: false, description: 'The domain this system belongs to' }
 ]
 }
 },
 API: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'API',
 fields: {
 metadata: [
 { name: 'name', type: 'string', required: true, description: 'Unique name of the API', pattern: '^[a-z0-9-]+$' },
 { name: 'namespace', type: 'string', required: false, description: 'Namespace for the API' },
 { name: 'title', type: 'string', required: false, description: 'Human-readable title' },
 { name: 'description', type: 'string', required: false, description: 'A brief description' },
 { name: 'tags', type: 'array', required: false, description: 'Tags for categorization' }
 ],
 spec: [
 { name: 'type', type: 'string', required: true, description: 'The type of API', enum: ['openapi', 'asyncapi', 'graphql', 'grpc', 'trpc', 'other'] },
 { name: 'lifecycle', type: 'string', required: true, description: 'The lifecycle phase', enum: ['experimental', 'production', 'deprecated'] },
 { name: 'owner', type: 'string', required: true, description: 'The team or user that owns this API' },
 { name: 'definition', type: 'string', required: true, description: 'The API definition (inline or reference)' },
 { name: 'system', type: 'string', required: false, description: 'The system this API belongs to' }
 ]
 }
 },
 User: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'User',
 fields: {
 metadata: [
 { name: 'name', type: 'string', required: true, description: 'Username', pattern: '^[a-z0-9-]+$' },
 { name: 'namespace', type: 'string', required: false, description: 'Namespace for the user' },
 { name: 'title', type: 'string', required: false, description: 'Display name' },
 { name: 'description', type: 'string', required: false, description: 'User bio or description' }
 ],
 spec: [
 { name: 'profile', type: 'object', required: false, description: 'User profile information' },
 { name: 'memberOf', type: 'array', required: false, description: 'Groups this user belongs to' }
 ]
 }
 },
 Group: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Group',
 fields: {
 metadata: [
 { name: 'name', type: 'string', required: true, description: 'Group name', pattern: '^[a-z0-9-]+$' },
 { name: 'namespace', type: 'string', required: false, description: 'Namespace for the group' },
 { name: 'title', type: 'string', required: false, description: 'Display name' },
 { name: 'description', type: 'string', required: false, description: 'Group description' }
 ],
 spec: [
 { name: 'type', type: 'string', required: true, description: 'The type of group', enum: ['team', 'business-unit', 'product-area', 'root'] },
 { name: 'parent', type: 'string', required: false, description: 'Parent group reference' },
 { name: 'children', type: 'array', required: false, description: 'Child groups' },
 { name: 'members', type: 'array', required: false, description: 'Group members' }
 ]
 }
 }
};

export default function EntityEditorPage() {
 const params = useParams();
 const router = useRouter();
 const { kind, namespace, name } = params as { kind: string; namespace: string; name: string };

 const [entity, setEntity] = useState<any>({
 apiVersion: '',
 kind: '',
 metadata: {
 name: '',
 namespace: 'default'
 },
 spec: {}
 });

 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
 metadata: true,
 spec: true,
 relations: false,
 status: false
 });
 const [viewMode, setViewMode] = useState<'form' | 'yaml'>('form');
 const [yamlContent, setYamlContent] = useState('');

 useEffect(() => {
 if (kind && namespace && name) {
 // Editing existing entity
 fetchEntity();
 } else if (kind) {
 // Creating new entity
 const schema = ENTITY_SCHEMAS[kind];
 if (schema) {
 setEntity({
 apiVersion: schema.apiVersion,
 kind: schema.kind,
 metadata: {
 name: '',
 namespace: 'default'
 },
 spec: {}
 });
 }
 setLoading(false);
 }
 }, [kind, namespace, name]);

 const fetchEntity = async () => {
 try {
 // In production, fetch from API
 // Mock data for now
 const mockEntity = {
 apiVersion: 'backstage.io/v1alpha1',
 kind,
 metadata: {
 name,
 namespace,
 title: `${name} Service`,
 description: 'A microservice that handles core functionality',
 tags: ['backend', 'nodejs'],
 labels: {
 'backstage.io/managed-by': 'backstage'
 },
 annotations: {
 'backstage.io/edit-url': 'https://github.com/example/repo/edit/main/catalog-info.yaml'
 },
 links: [
 {
 url: 'https://dashboard.example.com',
 title: 'Dashboard',
 icon: 'dashboard'
 }
 ]
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-platform',
 system: 'core-platform'
 }
 };

 setEntity(mockEntity);
 setYamlContent(yaml.dump(mockEntity));
 } catch (error) {
 console.error('Failed to fetch entity:', error);
 toast.error('Failed to load entity');
 } finally {
 setLoading(false);
 }
 };

 const validateEntity = (): boolean => {
 const newErrors: Record<string, string> = {};
 const schema = ENTITY_SCHEMAS[entity.kind];

 if (!schema) {
 newErrors.general = 'Unknown entity kind';
 setErrors(newErrors);
 return false;
 }

 // Validate metadata fields
 schema.fields.metadata.forEach(field => {
 if (field.required && !entity.metadata[field.name]) {
 newErrors[`metadata.${field.name}`] = `${field.name} is required`;
 }
 if (field.pattern && entity.metadata[field.name]) {
 const regex = new RegExp(field.pattern);
 if (!regex.test(entity.metadata[field.name])) {
 newErrors[`metadata.${field.name}`] = `Invalid format for ${field.name}`;
 }
 }
 });

 // Validate spec fields
 schema.fields.spec.forEach(field => {
 if (field.required && !entity.spec[field.name]) {
 newErrors[`spec.${field.name}`] = `${field.name} is required`;
 }
 });

 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSave = async () => {
 if (!validateEntity()) {
 toast.error('Please fix validation errors');
 return;
 }

 setSaving(true);
 try {
 // In production, save via API
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 toast.success('Entity saved successfully');
 router.push(`/catalog/${entity.kind.toLowerCase()}/${entity.metadata.namespace}/${entity.metadata.name}`);
 } catch (error) {
 console.error('Failed to save entity:', error);
 toast.error('Failed to save entity');
 } finally {
 setSaving(false);
 }
 };

 const updateField = (path: string, value: any) => {
 const keys = path.split('.');
 const newEntity = { ...entity };
 let current = newEntity;

 for (let i = 0; i < keys.length - 1; i++) {
 if (!current[keys[i]]) {
 current[keys[i]] = {};
 }
 current = current[keys[i]];
 }

 current[keys[keys.length - 1]] = value;
 setEntity(newEntity);
 
 // Clear error for this field
 if (errors[path]) {
 const newErrors = { ...errors };
 delete newErrors[path];
 setErrors(newErrors);
 }
 };

 const addArrayItem = (path: string, defaultValue: any = '') => {
 const current = getFieldValue(path) || [];
 updateField(path, [...current, defaultValue]);
 };

 const removeArrayItem = (path: string, index: number) => {
 const current = getFieldValue(path) || [];
 updateField(path, current.filter((_: any, i: number) => i !== index));
 };

 const getFieldValue = (path: string): any => {
 const keys = path.split('.');
 let current = entity;
 
 for (const key of keys) {
 current = current?.[key];
 }
 
 return current;
 };

 const toggleSection = (section: string) => {
 setExpandedSections(prev => ({
 ...prev,
 [section]: !prev[section]
 }));
 };

 const renderField = (field: EntityField, path: string) => {
 const value = getFieldValue(path);
 const error = errors[path];

 switch (field.type) {
 case 'string':
 if (field.enum) {
 return (
 <select
 value={value || ''}
 onChange={(e) => updateField(path, e.target.value)}
 className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 >
 <option value="">Select {field.name}</option>
 {field.enum.map(option => (
 <option key={option} value={option}>{option}</option>
 ))}
 </select>
 );
 }
 return (
 <input
 type="text"
 value={value || ''}
 onChange={(e) => updateField(path, e.target.value)}
 placeholder={field.example || ''}
 className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 );

 case 'boolean':
 return (
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={value || false}
 onChange={(e) => updateField(path, e.target.checked)}
 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
 />
 <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
 Enable {field.name}
 </span>
 </label>
 );

 case 'array':
 const items = value || [];
 return (
 <div className="space-y-2">
 {items.map((item: any, index: number) => (
 <div key={index} className="flex items-center gap-2">
 <input
 type="text"
 value={item}
 onChange={(e) => {
 const newItems = [...items];
 newItems[index] = e.target.value;
 updateField(path, newItems);
 }}
 className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 <button
 onClick={() => removeArrayItem(path, index)}
 className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 ))}
 <button
 onClick={() => addArrayItem(path)}
 className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <Plus className="w-4 h-4 mr-1" />
 Add {field.name}
 </button>
 </div>
 );

 case 'object':
 return (
 <div className="space-y-2">
 <textarea
 value={JSON.stringify(value || {}, null, 2)}
 onChange={(e) => {
 try {
 const parsed = JSON.parse(e.target.value);
 updateField(path, parsed);
 } catch {}
 }}
 rows={4}
 className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100 ${
 error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
 }`}
 />
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Enter valid JSON format
 </p>
 </div>
 );

 default:
 return null;
 }
 };

 const renderYamlEditor = () => {
 return (
 <div className="h-full flex flex-col">
 <div className="flex-1">
 <textarea
 value={yamlContent}
 onChange={(e) => {
 setYamlContent(e.target.value);
 try {
 const parsed = yaml.load(e.target.value);
 setEntity(parsed);
 setErrors({});
 } catch (error) {
 setErrors({ yaml: 'Invalid YAML format' });
 }
 }}
 className="w-full h-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-900 dark:text-gray-100"
 spellCheck={false}
 />
 </div>
 {errors.yaml && (
 <div className="mt-2 text-sm text-red-600 dark:text-red-400">
 {errors.yaml}
 </div>
 )}
 </div>
 );
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
 </div>
 );
 }

 const schema = ENTITY_SCHEMAS[entity.kind];

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {name ? `Edit ${kind}` : `Create New ${kind}`}
 </h1>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 {name ? `Editing ${namespace}/${name}` : 'Fill in the details below to create a new entity'}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setViewMode(viewMode === 'form' ? 'yaml' : 'form')}
 className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 {viewMode === 'form' ? (
 <><FileCode className="w-4 h-4 mr-1" /> YAML View</>
 ) : (
 <><Eye className="w-4 h-4 mr-1" /> Form View</>
 )}
 </button>
 </div>
 </div>

 {/* Validation Errors Summary */}
 {Object.keys(errors).length > 0 && errors.general && (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
 <div className="flex">
 <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
 <div className="text-sm text-red-800 dark:text-red-200">
 <h3 className="font-medium mb-1">Validation Errors</h3>
 <p>{errors.general}</p>
 </div>
 </div>
 </div>
 )}

 {/* Editor */}
 {viewMode === 'yaml' ? (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-96">
 {renderYamlEditor()}
 </div>
 ) : (
 <div className="space-y-6">
 {/* Metadata Section */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <button
 onClick={() => toggleSection('metadata')}
 className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-750"
 >
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Metadata
 </h2>
 {expandedSections.metadata ? (
 <ChevronDown className="w-5 h-5 text-gray-400" />
 ) : (
 <ChevronRight className="w-5 h-5 text-gray-400" />
 )}
 </button>
 
 {expandedSections.metadata && (
 <div className="px-6 pb-6 space-y-4">
 {schema?.fields.metadata.map(field => (
 <div key={field.name}>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {field.name}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </label>
 {field.description && (
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
 {field.description}
 </p>
 )}
 {renderField(field, `metadata.${field.name}`)}
 {errors[`metadata.${field.name}`] && (
 <p className="mt-1 text-sm text-red-600 dark:text-red-400">
 {errors[`metadata.${field.name}`]}
 </p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Spec Section */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <button
 onClick={() => toggleSection('spec')}
 className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-750"
 >
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Specification
 </h2>
 {expandedSections.spec ? (
 <ChevronDown className="w-5 h-5 text-gray-400" />
 ) : (
 <ChevronRight className="w-5 h-5 text-gray-400" />
 )}
 </button>
 
 {expandedSections.spec && (
 <div className="px-6 pb-6 space-y-4">
 {schema?.fields.spec.map(field => (
 <div key={field.name}>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {field.name}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </label>
 {field.description && (
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
 {field.description}
 </p>
 )}
 {renderField(field, `spec.${field.name}`)}
 {errors[`spec.${field.name}`] && (
 <p className="mt-1 text-sm text-red-600 dark:text-red-400">
 {errors[`spec.${field.name}`]}
 </p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Relations Section (for existing entities) */}
 {name && (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <button
 onClick={() => toggleSection('relations')}
 className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-750"
 >
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Relations
 </h2>
 {expandedSections.relations ? (
 <ChevronDown className="w-5 h-5 text-gray-400" />
 ) : (
 <ChevronRight className="w-5 h-5 text-gray-400" />
 )}
 </button>
 
 {expandedSections.relations && (
 <div className="px-6 pb-6">
 <div className="text-sm text-gray-600 dark:text-gray-400">
 <p>Relations are automatically managed by Backstage based on entity references.</p>
 <p className="mt-2">Current relations will be displayed in the entity view.</p>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* Actions */}
 <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
 <button
 onClick={() => router.back()}
 className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <X className="w-4 h-4 mr-2" />
 Cancel
 </button>
 
 <div className="flex items-center gap-3">
 <button
 onClick={() => {
 const content = viewMode === 'yaml' ? yamlContent : yaml.dump(entity);
 navigator.clipboard.writeText(content);
 toast.success('Copied to clipboard');
 }}
 className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <Copy className="w-4 h-4 mr-2" />
 Copy YAML
 </button>
 
 <button
 onClick={handleSave}
 disabled={saving}
 className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {saving ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
 Saving...
 </>
 ) : (
 <>
 <Save className="w-4 h-4 mr-2" />
 Save Entity
 </>
 )}
 </button>
 </div>
 </div>

 {/* Help Section */}
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <div className="flex">
 <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
 <div className="text-sm text-blue-800 dark:text-blue-200">
 <h3 className="font-medium mb-1">Entity Tips</h3>
 <ul className="list-disc list-inside space-y-1">
 <li>Use lowercase letters, numbers, and hyphens for names</li>
 <li>Owner should reference an existing User or Group entity</li>
 <li>Tags help with discovery and filtering in the catalog</li>
 <li>Links appear on the entity page for quick access to resources</li>
 </ul>
 </div>
 </div>
 </div>
 </div>
 );
}