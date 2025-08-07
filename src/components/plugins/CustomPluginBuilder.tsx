'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
 Package,
 Download,
 Code,
 Settings,
 CheckCircle,
 AlertCircle,
 FileText,
 Zap,
 Database,
 Globe,
 Layers,
 Terminal,
 ArrowRight,
 Copy,
 Eye,
 Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CustomPluginTemplate {
 id: string;
 name: string;
 description: string;
 category: string;
 baseTemplate: 'frontend' | 'backend' | 'fullstack' | 'extension';
}

interface PluginFile {
 path: string;
 content: string;
}

interface BuildResult {
 success: boolean;
 pluginId: string;
 packageName: string;
 files: PluginFile[];
 installInstructions: string[];
 error?: string;
}

export function CustomPluginBuilder() {
 const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
 const [step, setStep] = useState<'select' | 'configure' | 'build' | 'download'>('select');
 const [customization, setCustomization] = useState({
 pluginName: '',
 pluginId: '',
 description: '',
 owner: 'platform-team',
 configuration: {}
 });
 const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
 const [previewFile, setPreviewFile] = useState<PluginFile | null>(null);

 // Fetch available templates
 const { data: templatesData, isLoading: templatesLoading } = useQuery({
 queryKey: ['plugin-builder-templates'],
 queryFn: async () => {
 const response = await fetch('/api/plugins/builder?action=templates');
 if (!response.ok) {
 throw new Error('Failed to fetch templates');
 }
 return response.json();
 }
 });

 // Fetch template details
 const { data: templateData, isLoading: templateLoading } = useQuery({
 queryKey: ['plugin-builder-template', selectedTemplate],
 queryFn: async () => {
 if (!selectedTemplate) return null;
 const response = await fetch(`/api/plugins/builder?action=template&id=${selectedTemplate}`);
 if (!response.ok) {
 throw new Error('Failed to fetch template details');
 }
 return response.json();
 },
 enabled: !!selectedTemplate
 });

 // Build plugin mutation
 const buildMutation = useMutation({
 mutationFn: async (data: { templateId: string; customization: any }) => {
 const response = await fetch('/api/plugins/builder', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 action: 'build',
 templateId: data.templateId,
 customization: data.customization
 }),
 });
 
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Failed to build plugin');
 }
 
 return response.json();
 },
 onSuccess: (result) => {
 setBuildResult(result);
 setStep('download');
 toast.success('Plugin built successfully!');
 },
 onError: (error: any) => {
 toast.error(`Failed to build plugin: ${error.message}`);
 }
 });

 const templates = templatesData?.templates || [];

 // Category icons
 const categoryIcons: Record<string, React.ComponentType<any>> = {
 'integration': Globe,
 'visualization': Layers,
 'backend': Database,
 'frontend': Code,
 'automation': Zap,
 'monitoring': Settings,
 'development': Terminal
 };

 const handleTemplateSelect = (templateId: string) => {
 setSelectedTemplate(templateId);
 setStep('configure');
 };

 const handleCustomizationChange = (field: string, value: any) => {
 setCustomization(prev => ({
 ...prev,
 [field]: value
 }));
 };

 const handleConfigurationChange = (field: string, value: any) => {
 setCustomization(prev => ({
 ...prev,
 configuration: {
 ...prev.configuration,
 [field]: value
 }
 }));
 };

 const handleBuild = () => {
 if (!selectedTemplate) return;
 
 setStep('build');
 buildMutation.mutate({
 templateId: selectedTemplate,
 customization
 });
 };

 const copyToClipboard = (text: string) => {
 navigator.clipboard.writeText(text);
 toast.success('Copied to clipboard!');
 };

 const downloadAsZip = () => {
 if (!buildResult?.files) return;
 
 // This would typically create a ZIP file
 // For now, we'll show the files for copying
 toast.success('Plugin files are ready for download!');
 };

 if (templatesLoading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="text-center">
 <Package className="w-8 h-8 animate-pulse text-blue-600 mx-auto mb-4" />
 <p className="text-gray-600 dark:text-gray-400">Loading plugin templates...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-8 text-white">
 <h1 className="text-3xl font-bold mb-2">Custom Plugin Builder</h1>
 <p className="text-purple-100 mb-6">
 Create custom Backstage plugins with no-code configuration
 </p>
 
 {/* Step indicator */}
 <div className="flex items-center space-x-4">
 <div className={`flex items-center ${step === 'select' ? 'text-white' : 'text-purple-200'}`}>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'select' ? 'bg-white text-purple-600' : 'border-2 border-purple-200'}`}>
 1
 </div>
 <span className="ml-2">Select Template</span>
 </div>
 <ArrowRight className="w-4 h-4 text-purple-200" />
 <div className={`flex items-center ${step === 'configure' ? 'text-white' : 'text-purple-200'}`}>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'configure' ? 'bg-white text-purple-600' : 'border-2 border-purple-200'}`}>
 2
 </div>
 <span className="ml-2">Configure</span>
 </div>
 <ArrowRight className="w-4 h-4 text-purple-200" />
 <div className={`flex items-center ${step === 'build' ? 'text-white' : 'text-purple-200'}`}>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'build' ? 'bg-white text-purple-600' : 'border-2 border-purple-200'}`}>
 3
 </div>
 <span className="ml-2">Build</span>
 </div>
 <ArrowRight className="w-4 h-4 text-purple-200" />
 <div className={`flex items-center ${step === 'download' ? 'text-white' : 'text-purple-200'}`}>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'download' ? 'bg-white text-purple-600' : 'border-2 border-purple-200'}`}>
 4
 </div>
 <span className="ml-2">Download</span>
 </div>
 </div>
 </div>

 {/* Step 1: Template Selection */}
 {step === 'select' && (
 <div>
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Choose a Plugin Template
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {templates.map((template: CustomPluginTemplate) => {
 const IconComponent = categoryIcons[template.category] || Package;
 return (
 <div
 key={template.id}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer"
 onClick={() => handleTemplateSelect(template.id)}
 >
 <div className="flex items-center gap-3 mb-4">
 <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 flex items-center justify-center">
 <IconComponent className="w-6 h-6 text-purple-600" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 dark:text-gray-100">
 {template.name}
 </h3>
 <span className="text-xs text-purple-600 bg-purple-100 dark:bg-purple-900/20 px-2 py-1 rounded">
 {template.baseTemplate}
 </span>
 </div>
 </div>
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
 {template.description}
 </p>
 <div className="flex items-center justify-between">
 <span className="text-xs text-gray-500 capitalize">
 {template.category}
 </span>
 <ArrowRight className="w-4 h-4 text-gray-400" />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Step 2: Configuration */}
 {step === 'configure' && templateData && (
 <div className="max-w-4xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Configure Your Plugin
 </h2>
 <button
 onClick={() => setStep('select')}
 className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
 >
 Back to Templates
 </button>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Basic Information */}
 <div>
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
 Basic Information
 </h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Plugin Name
 </label>
 <input
 type="text"
 value={customization.pluginName}
 onChange={(e) => handleCustomizationChange('pluginName', e.target.value)}
 placeholder="My Custom Plugin"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Plugin ID
 </label>
 <input
 type="text"
 value={customization.pluginId}
 onChange={(e) => handleCustomizationChange('pluginId', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
 placeholder="my-custom-plugin"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 <p className="text-xs text-gray-500 mt-1">
 Only lowercase letters, numbers, and hyphens allowed
 </p>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Description
 </label>
 <textarea
 value={customization.description}
 onChange={(e) => handleCustomizationChange('description', e.target.value)}
 placeholder="Brief description of your plugin"
 rows={3}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Owner
 </label>
 <input
 type="text"
 value={customization.owner}
 onChange={(e) => handleCustomizationChange('owner', e.target.value)}
 placeholder="platform-team"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 </div>
 </div>

 {/* Template Configuration */}
 <div>
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
 Template Configuration
 </h3>
 <div className="space-y-4">
 {templateData.template.configSchema.sections.map((section: any) => (
 <div key={section.title}>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
 {section.title}
 </h4>
 {section.fields.map((field: any) => (
 <div key={field.name} className="mb-3">
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 {field.label}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </label>
 {field.type === 'text' || field.type === 'url' ? (
 <input
 type="text"
 value={customization.configuration[field.name] || field.defaultValue || ''}
 onChange={(e) => handleConfigurationChange(field.name, e.target.value)}
 placeholder={field.placeholder}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
 />
 ) : field.type === 'number' ? (
 <input
 type="number"
 value={customization.configuration[field.name] || field.defaultValue || ''}
 onChange={(e) => handleConfigurationChange(field.name, Number(e.target.value))}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
 />
 ) : field.type === 'boolean' ? (
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={customization.configuration[field.name] ?? field.defaultValue ?? false}
 onChange={(e) => handleConfigurationChange(field.name, e.target.checked)}
 className="rounded border-gray-300 dark:border-gray-600"
 />
 <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
 {field.description}
 </span>
 </label>
 ) : null}
 {field.description && field.type !== 'boolean' && (
 <p className="text-xs text-gray-500 mt-1">{field.description}</p>
 )}
 </div>
 ))}
 </div>
 ))}
 </div>
 </div>
 </div>

 <div className="flex justify-end mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
 <button
 onClick={handleBuild}
 disabled={!customization.pluginName || !customization.pluginId || !customization.description}
 className="inline-flex items-center px-6 py-3 text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium"
 >
 <Code className="w-4 h-4 mr-2" />
 Build Plugin
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Step 3: Building */}
 {step === 'build' && (
 <div className="max-w-2xl mx-auto text-center">
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
 <Package className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
 Building Your Plugin
 </h2>
 <p className="text-gray-600 dark:text-gray-400 mb-4">
 Generating plugin files and configuration...
 </p>
 <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto">
 <div className="h-2 bg-purple-600 rounded-full animate-pulse" style={{ width: '70%' }}></div>
 </div>
 </div>
 </div>
 )}

 {/* Step 4: Download */}
 {step === 'download' && buildResult && (
 <div className="max-w-6xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Plugin Built Successfully!
 </h2>
 <button
 onClick={() => {
 setStep('select');
 setSelectedTemplate(null);
 setCustomization({
 pluginName: '',
 pluginId: '',
 description: '',
 owner: 'platform-team',
 configuration: {}
 });
 setBuildResult(null);
 }}
 className="text-purple-600 hover:text-purple-700"
 >
 Build Another Plugin
 </button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Plugin Info */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Plugin Information
 </h3>
 <div className="space-y-3">
 <div>
 <span className="text-sm text-gray-500">Plugin ID:</span>
 <p className="font-mono text-sm">{buildResult.pluginId}</p>
 </div>
 <div>
 <span className="text-sm text-gray-500">Package Name:</span>
 <p className="font-mono text-sm">{buildResult.packageName}</p>
 </div>
 <div>
 <span className="text-sm text-gray-500">Files Generated:</span>
 <p className="font-mono text-sm">{buildResult.files?.length || 0}</p>
 </div>
 </div>
 
 <button
 onClick={downloadAsZip}
 className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg"
 >
 <Download className="w-4 h-4 mr-2" />
 Download Plugin
 </button>
 </div>

 {/* Installation Instructions */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Installation Instructions
 </h3>
 <div className="space-y-2">
 {buildResult.installInstructions?.map((instruction, index) => (
 <div key={index} className="flex items-start gap-2">
 <span className="flex-shrink-0 w-5 h-5 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
 {index + 1}
 </span>
 <p className="text-sm text-gray-600 dark:text-gray-400">{instruction}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Files List */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Generated Files
 </h3>
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {buildResult.files?.map((file, index) => (
 <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
 <div className="flex items-center gap-2">
 <FileText className="w-4 h-4 text-gray-400" />
 <span className="text-sm font-mono">{file.path}</span>
 </div>
 <div className="flex gap-1">
 <button
 onClick={() => setPreviewFile(file)}
 className="p-1 text-gray-400 hover:text-gray-600"
 >
 <Eye className="w-4 h-4" />
 </button>
 <button
 onClick={() => copyToClipboard(file.content)}
 className="p-1 text-gray-400 hover:text-gray-600"
 >
 <Copy className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* File Preview Modal */}
 {previewFile && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
 <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-96 overflow-hidden">
 <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
 <h3 className="font-semibold text-gray-900 dark:text-gray-100">
 {previewFile.path}
 </h3>
 <button
 onClick={() => setPreviewFile(null)}
 className="text-gray-400 hover:text-gray-600"
 >
 X
 </button>
 </div>
 <div className="p-4 overflow-auto max-h-80">
 <pre className="text-sm bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-x-auto">
 <code>{previewFile.content}</code>
 </pre>
 </div>
 <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
 <button
 onClick={() => copyToClipboard(previewFile.content)}
 className="inline-flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
 >
 <Copy className="w-4 h-4 mr-2" />
 Copy
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
}