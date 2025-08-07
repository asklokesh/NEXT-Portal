'use client';

import React, { useState, useCallback } from 'react';
import { 
 FileCode, 
 Plus, 
 Trash2, 
 Save, 
 Eye, 
 Settings,
 ChevronRight,
 ChevronDown,
 Package,
 GitBranch,
 Database,
 Code,
 Layers,
 AlertCircle,
 Check,
 Copy,
 Download,
 Upload,
 Sparkles,
 Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import yaml from 'js-yaml';

interface TemplateParameter {
 id: string;
 name: string;
 title: string;
 description: string;
 type: 'string' | 'number' | 'boolean' | 'array' | 'object';
 default?: any;
 enum?: string[];
 pattern?: string;
 required: boolean;
 ui?: {
 widget?: string;
 help?: string;
 placeholder?: string;
 autofocus?: boolean;
 };
}

interface TemplateStep {
 id: string;
 name: string;
 action: string;
 input?: Record<string, any>;
}

interface SoftwareTemplate {
 apiVersion: string;
 kind: string;
 metadata: {
 name: string;
 title: string;
 description: string;
 tags?: string[];
 };
 spec: {
 type: string;
 owner: string;
 parameters: {
 required?: string[];
 properties: Record<string, any>;
 }[];
 steps: TemplateStep[];
 output?: {
 links?: Array<{
 url: string;
 title: string;
 icon?: string;
 }>;
 };
 };
}

export default function TemplateBuilderPage() {
 const [template, setTemplate] = useState<SoftwareTemplate>({
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'new-template',
 title: 'New Template',
 description: 'A new software template',
 tags: []
 },
 spec: {
 type: 'service',
 owner: 'platform-team',
 parameters: [],
 steps: []
 }
 });

 const [parameters, setParameters] = useState<TemplateParameter[]>([]);
 const [selectedParameter, setSelectedParameter] = useState<string | null>(null);
 const [showPreview, setShowPreview] = useState(false);
 const [activeTab, setActiveTab] = useState<'basic' | 'parameters' | 'steps' | 'preview'>('basic');
 const [yamlView, setYamlView] = useState(false);

 // Common template presets
 const templatePresets = [
 {
 id: 'nodejs-service',
 name: 'Node.js Service',
 icon: Package,
 description: 'Create a Node.js microservice with Express'
 },
 {
 id: 'react-app',
 name: 'React Application',
 icon: Code,
 description: 'Create a React application with TypeScript'
 },
 {
 id: 'python-api',
 name: 'Python API',
 icon: Database,
 description: 'Create a Python API with FastAPI'
 },
 {
 id: 'documentation',
 name: 'Documentation Site',
 icon: FileCode,
 description: 'Create a documentation site with MkDocs'
 }
 ];

 // Common parameter types
 const parameterTypes = [
 { value: 'string', label: 'Text', icon: 'Aa' },
 { value: 'number', label: 'Number', icon: '123' },
 { value: 'boolean', label: 'Yes/No', icon: 'Y/N' },
 { value: 'array', label: 'List', icon: '[]' },
 { value: 'object', label: 'Object', icon: '{}' }
 ];

 // Common scaffolder actions
 const scaffolderActions = [
 {
 id: 'fetch:template',
 name: 'Fetch Template',
 description: 'Fetch template files from a repository',
 icon: GitBranch,
 inputs: [
 { name: 'url', type: 'string', required: true, description: 'Repository URL' },
 { name: 'values', type: 'object', required: true, description: 'Template values' }
 ]
 },
 {
 id: 'publish:github',
 name: 'Publish to GitHub',
 description: 'Create a new GitHub repository',
 icon: GitBranch,
 inputs: [
 { name: 'repoUrl', type: 'string', required: true, description: 'Repository URL' },
 { name: 'description', type: 'string', required: false, description: 'Repository description' },
 { name: 'defaultBranch', type: 'string', required: false, description: 'Default branch name' }
 ]
 },
 {
 id: 'register',
 name: 'Register in Catalog',
 description: 'Register component in Backstage catalog',
 icon: Database,
 inputs: [
 { name: 'repoContentsUrl', type: 'string', required: true, description: 'Repository contents URL' },
 { name: 'catalogInfoPath', type: 'string', required: false, description: 'Path to catalog-info.yaml' }
 ]
 }
 ];

 const addParameter = () => {
 const newParam: TemplateParameter = {
 id: `param-${Date.now()}`,
 name: `parameter${parameters.length + 1}`,
 title: `Parameter ${parameters.length + 1}`,
 description: '',
 type: 'string',
 required: false,
 ui: {}
 };
 setParameters([...parameters, newParam]);
 setSelectedParameter(newParam.id);
 };

 const updateParameter = (id: string, updates: Partial<TemplateParameter>) => {
 setParameters(params => params.map(p => 
 p.id === id ? { ...p, ...updates } : p
 ));
 };

 const deleteParameter = (id: string) => {
 setParameters(params => params.filter(p => p.id !== id));
 if (selectedParameter === id) {
 setSelectedParameter(null);
 }
 };

 const addStep = (action: typeof scaffolderActions[0]) => {
 const newStep: TemplateStep = {
 id: `step-${Date.now()}`,
 name: action.name.toLowerCase().replace(/\s+/g, '-'),
 action: action.id,
 input: {}
 };
 
 setTemplate(prev => ({
 ...prev,
 spec: {
 ...prev.spec,
 steps: [...prev.spec.steps, newStep]
 }
 }));
 };

 const updateStep = (stepId: string, updates: Partial<TemplateStep>) => {
 setTemplate(prev => ({
 ...prev,
 spec: {
 ...prev.spec,
 steps: prev.spec.steps.map(s => 
 s.id === stepId ? { ...s, ...updates } : s
 )
 }
 }));
 };

 const deleteStep = (stepId: string) => {
 setTemplate(prev => ({
 ...prev,
 spec: {
 ...prev.spec,
 steps: prev.spec.steps.filter(s => s.id !== stepId)
 }
 }));
 };

 const generateYAML = useCallback(() => {
 // Convert parameters to template format
 const templateParams = parameters.length > 0 ? [{
 required: parameters.filter(p => p.required).map(p => p.name),
 properties: parameters.reduce((acc, param) => {
 acc[param.name] = {
 title: param.title,
 type: param.type,
 description: param.description,
 ...(param.default !== undefined && { default: param.default }),
 ...(param.enum && { enum: param.enum }),
 ...(param.pattern && { pattern: param.pattern }),
 ...(param.ui && Object.keys(param.ui).length > 0 && { 'ui:field': param.ui })
 };
 return acc;
 }, {} as Record<string, any>)
 }] : [];

 const templateObj = {
 ...template,
 spec: {
 ...template.spec,
 parameters: templateParams,
 steps: template.spec.steps.map(({ id, ...step }) => step)
 }
 };

 return yaml.dump(templateObj, {
 styles: {
 '!!null': 'canonical'
 },
 sortKeys: false,
 lineWidth: 120
 });
 }, [template, parameters]);

 const saveTemplate = async () => {
 try {
 const yamlContent = generateYAML();
 
 // In production, this would save to the Backstage templates directory
 const blob = new Blob([yamlContent], { type: 'text/yaml' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${template.metadata.name}.yaml`;
 a.click();
 URL.revokeObjectURL(url);
 
 toast.success('Template saved successfully');
 } catch (error) {
 console.error('Failed to save template:', error);
 toast.error('Failed to save template');
 }
 };

 const loadPreset = (presetId: string) => {
 // Load preset template configuration
 switch (presetId) {
 case 'nodejs-service':
 setTemplate(prev => ({
 ...prev,
 metadata: {
 ...prev.metadata,
 name: 'nodejs-service',
 title: 'Node.js Service',
 description: 'Create a Node.js microservice with Express, TypeScript, and Docker',
 tags: ['nodejs', 'typescript', 'docker']
 },
 spec: {
 ...prev.spec,
 type: 'service'
 }
 }));
 
 setParameters([
 {
 id: 'param-1',
 name: 'name',
 title: 'Service Name',
 description: 'Unique name for the service',
 type: 'string',
 required: true,
 pattern: '^[a-z0-9-]+$',
 ui: { placeholder: 'my-service' }
 },
 {
 id: 'param-2',
 name: 'description',
 title: 'Description',
 description: 'What does this service do?',
 type: 'string',
 required: true,
 ui: { widget: 'textarea' }
 },
 {
 id: 'param-3',
 name: 'owner',
 title: 'Owner',
 description: 'Team or user that owns this service',
 type: 'string',
 required: true,
 ui: { placeholder: 'platform-team' }
 }
 ]);
 break;
 
 // Add more presets...
 }
 
 toast.success('Preset loaded successfully');
 };

 const renderBasicInfo = () => (
 <div className="space-y-6">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Template Name
 </label>
 <input
 type="text"
 value={template.metadata.name}
 onChange={(e) => setTemplate(prev => ({
 ...prev,
 metadata: { ...prev.metadata, name: e.target.value }
 }))}
 placeholder="my-template"
 pattern="^[a-z0-9-]+$"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
 Lowercase letters, numbers, and hyphens only
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Template Title
 </label>
 <input
 type="text"
 value={template.metadata.title}
 onChange={(e) => setTemplate(prev => ({
 ...prev,
 metadata: { ...prev.metadata, title: e.target.value }
 }))}
 placeholder="My Template"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Description
 </label>
 <textarea
 value={template.metadata.description}
 onChange={(e) => setTemplate(prev => ({
 ...prev,
 metadata: { ...prev.metadata, description: e.target.value }
 }))}
 rows={3}
 placeholder="Describe what this template creates..."
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Template Type
 </label>
 <select
 value={template.spec.type}
 onChange={(e) => setTemplate(prev => ({
 ...prev,
 spec: { ...prev.spec, type: e.target.value }
 }))}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="service">Service</option>
 <option value="website">Website</option>
 <option value="library">Library</option>
 <option value="documentation">Documentation</option>
 <option value="other">Other</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Owner
 </label>
 <input
 type="text"
 value={template.spec.owner}
 onChange={(e) => setTemplate(prev => ({
 ...prev,
 spec: { ...prev.spec, owner: e.target.value }
 }))}
 placeholder="platform-team"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Load from Preset
 </label>
 <div className="grid grid-cols-2 gap-3">
 {templatePresets.map(preset => {
 const Icon = preset.icon;
 return (
 <button
 key={preset.id}
 onClick={() => loadPreset(preset.id)}
 className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 text-left"
 >
 <Icon className="w-5 h-5 text-gray-400 mb-2" />
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {preset.name}
 </h4>
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {preset.description}
 </p>
 </button>
 );
 })}
 </div>
 </div>
 </div>
 );

 const renderParameters = () => (
 <div className="flex gap-6 h-full">
 {/* Parameter List */}
 <div className="w-80 space-y-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Template Parameters
 </h3>
 <button
 onClick={addParameter}
 className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
 >
 <Plus className="w-4 h-4 mr-1" />
 Add Parameter
 </button>
 </div>
 
 {parameters.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
 <p className="text-sm">No parameters yet</p>
 <p className="text-xs mt-1">Add parameters to collect user input</p>
 </div>
 ) : (
 <div className="space-y-2">
 {parameters.map(param => (
 <div
 key={param.id}
 onClick={() => setSelectedParameter(param.id)}
 className={`p-3 border rounded-lg cursor-pointer transition-colors ${
 selectedParameter === param.id
 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
 : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
 }`}
 >
 <div className="flex items-start justify-between">
 <div>
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {param.title}
 </h4>
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {param.name} ({param.type})
 </p>
 </div>
 <button
 onClick={(e) => {
 e.stopPropagation();
 deleteParameter(param.id);
 }}
 className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Parameter Editor */}
 <div className="flex-1">
 {selectedParameter && parameters.find(p => p.id === selectedParameter) ? (
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 space-y-4">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
 Edit Parameter
 </h3>
 
 {(() => {
 const param = parameters.find(p => p.id === selectedParameter)!;
 return (
 <>
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Parameter Name
 </label>
 <input
 type="text"
 value={param.name}
 onChange={(e) => updateParameter(param.id, { name: e.target.value })}
 pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Display Title
 </label>
 <input
 type="text"
 value={param.title}
 onChange={(e) => updateParameter(param.id, { title: e.target.value })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Description
 </label>
 <textarea
 value={param.description}
 onChange={(e) => updateParameter(param.id, { description: e.target.value })}
 rows={2}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Data Type
 </label>
 <select
 value={param.type}
 onChange={(e) => updateParameter(param.id, { 
 type: e.target.value as TemplateParameter['type'] 
 })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 {parameterTypes.map(type => (
 <option key={type.value} value={type.value}>
 {type.label} ({type.icon})
 </option>
 ))}
 </select>
 </div>

 <div className="flex items-center">
 <input
 type="checkbox"
 id="required"
 checked={param.required}
 onChange={(e) => updateParameter(param.id, { required: e.target.checked })}
 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
 />
 <label htmlFor="required" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
 Required field
 </label>
 </div>

 {param.type === 'string' && (
 <>
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Pattern (RegEx)
 </label>
 <input
 type="text"
 value={param.pattern || ''}
 onChange={(e) => updateParameter(param.id, { pattern: e.target.value })}
 placeholder="^[a-z0-9-]+$"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Placeholder
 </label>
 <input
 type="text"
 value={param.ui?.placeholder || ''}
 onChange={(e) => updateParameter(param.id, { 
 ui: { ...param.ui, placeholder: e.target.value }
 })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </>
 )}

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Default Value
 </label>
 <input
 type="text"
 value={param.default || ''}
 onChange={(e) => updateParameter(param.id, { default: e.target.value })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </>
 );
 })()}
 </div>
 ) : (
 <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
 <div className="text-center">
 <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
 <p>Select a parameter to edit</p>
 </div>
 </div>
 )}
 </div>
 </div>
 );

 const renderSteps = () => (
 <div className="space-y-6">
 <div className="mb-6">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
 Template Actions
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
 Add actions to define what happens when someone uses this template
 </p>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {scaffolderActions.map(action => {
 const Icon = action.icon;
 return (
 <button
 key={action.id}
 onClick={() => addStep(action)}
 className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 text-left"
 >
 <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {action.name}
 </h4>
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {action.description}
 </p>
 </button>
 );
 })}
 </div>
 </div>

 <div>
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
 Template Steps
 </h3>
 
 {template.spec.steps.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
 <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
 <p className="text-sm">No steps defined</p>
 <p className="text-xs mt-1">Add actions above to define template steps</p>
 </div>
 ) : (
 <div className="space-y-3">
 {template.spec.steps.map((step, index) => {
 const actionDef = scaffolderActions.find(a => a.id === step.action);
 const Icon = actionDef?.icon || Zap;
 
 return (
 <div
 key={step.id}
 className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center">
 <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mr-3">
 <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
 {index + 1}
 </span>
 </div>
 <div>
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {actionDef?.name || step.action}
 </h4>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 {step.name}
 </p>
 </div>
 </div>
 <button
 onClick={() => deleteStep(step.id)}
 className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 
 {/* Step inputs */}
 <div className="space-y-2 ml-11">
 {actionDef?.inputs.map(input => (
 <div key={input.name}>
 <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
 {input.name} {input.required && <span className="text-red-500">*</span>}
 </label>
 <input
 type="text"
 placeholder={input.description}
 value={step.input?.[input.name] || ''}
 onChange={(e) => updateStep(step.id, {
 input: { ...step.input, [input.name]: e.target.value }
 })}
 className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );

 const renderPreview = () => {
 const yamlContent = generateYAML();
 
 return (
 <div className="h-full flex flex-col">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Template Preview
 </h3>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setYamlView(!yamlView)}
 className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
 >
 {yamlView ? 'Visual' : 'YAML'} View
 </button>
 <button
 onClick={() => {
 navigator.clipboard.writeText(yamlContent);
 toast.success('Copied to clipboard');
 }}
 className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 >
 <Copy className="w-4 h-4" />
 </button>
 </div>
 </div>
 
 {yamlView ? (
 <div className="flex-1 bg-gray-900 rounded-lg p-4 overflow-auto">
 <pre className="text-sm text-gray-100 font-mono">
 {yamlContent}
 </pre>
 </div>
 ) : (
 <div className="flex-1 space-y-6 overflow-auto">
 {/* Visual preview of the template form */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
 {template.metadata.title}
 </h2>
 <p className="text-gray-600 dark:text-gray-400 mb-6">
 {template.metadata.description}
 </p>
 
 {parameters.length > 0 && (
 <div className="space-y-4">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Parameters
 </h3>
 {parameters.map(param => (
 <div key={param.id}>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {param.title} {param.required && <span className="text-red-500">*</span>}
 </label>
 {param.description && (
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
 {param.description}
 </p>
 )}
 <input
 type={param.type === 'number' ? 'number' : 'text'}
 placeholder={param.ui?.placeholder || param.default || ''}
 disabled
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
 />
 </div>
 ))}
 </div>
 )}
 
 <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
 <button
 disabled
 className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md opacity-50 cursor-not-allowed"
 >
 Create from Template
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
 };

 return (
 <div className="h-full flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Template Builder
 </h1>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 Create Backstage templates visually without writing YAML
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={() => setShowPreview(!showPreview)}
 className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <Eye className="w-4 h-4 mr-2" />
 Preview
 </button>
 <button
 onClick={saveTemplate}
 className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
 >
 <Save className="w-4 h-4 mr-2" />
 Save Template
 </button>
 </div>
 </div>

 {/* Tabs */}
 <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
 <nav className="-mb-px flex space-x-8">
 {[
 { id: 'basic', label: 'Basic Info', icon: FileCode },
 { id: 'parameters', label: 'Parameters', icon: Settings },
 { id: 'steps', label: 'Steps', icon: Layers },
 { id: 'preview', label: 'Preview', icon: Eye }
 ].map(tab => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
 activeTab === tab.id
 ? 'border-blue-500 text-blue-600 dark:text-blue-400'
 : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
 }`}
 >
 <Icon className="w-4 h-4 mr-2" />
 {tab.label}
 </button>
 );
 })}
 </nav>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-hidden">
 {activeTab === 'basic' && renderBasicInfo()}
 {activeTab === 'parameters' && renderParameters()}
 {activeTab === 'steps' && renderSteps()}
 {activeTab === 'preview' && renderPreview()}
 </div>
 </div>
 );
}