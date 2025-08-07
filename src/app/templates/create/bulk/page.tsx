'use client';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import MonacoEditor from '@monaco-editor/react';
import { 
 ArrowLeft, 
 Upload, 
 Download, 
 FileText, 
 AlertCircle, 
 CheckCircle2, 
 AlertTriangle,
 Loader2,
 Eye,
 Play,
 FileCode,
 Database,
 Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

import { backstageClient } from '@/lib/backstage/client';
import { BulkImporter } from '@/lib/bulk-import';

import type { BulkImportResult, BulkImportOptions } from '@/lib/bulk-import';


type ImportFormat = 'csv' | 'json' | 'yaml';

const BulkImportPage = () => {
 const router = useRouter();
 const [importFormat, setImportFormat] = useState<ImportFormat>('csv');
 const [importData, setImportData] = useState('');
 const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [isCreating, setIsCreating] = useState(false);
 const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());
 const [showPreview, setShowPreview] = useState(false);
 const [options, setOptions] = useState<BulkImportOptions>({
 overwriteExisting: false,
 validateOnly: false,
 defaultOwner: '',
 defaultNamespace: 'default',
 skipValidation: false,
 });

 // Process import data
 const processImport = useCallback(() => {
 if (!importData.trim()) {
 toast.error('Please provide import data');
 return;
 }

 setIsProcessing(true);
 try {
 let result: BulkImportResult;
 
 switch (importFormat) {
 case 'csv':
 result = BulkImporter.importFromCSV(importData, options);
 break;
 case 'json':
 result = BulkImporter.importFromJSON(importData, options);
 break;
 case 'yaml':
 result = BulkImporter.importFromYAML(importData, options);
 break;
 default:
 throw new Error('Unsupported import format');
 }

 setImportResult(result);
 
 if (result.success) {
 toast.success(`Successfully processed ${result.summary.successful} services`);
 if (result.summary.warnings > 0) {
 toast.warning(`${result.summary.warnings} warnings found`);
 }
 } else {
 toast.error(`Failed to process ${result.summary.failed} services`);
 }

 // Auto-select all successful services
 const successfulIndices = result.services
 .map((service, index) => service.status !== 'error' ? index : -1)
 .filter(index => index !== -1);
 setSelectedServices(new Set(successfulIndices));

 } catch (error) {
 // console.error('Import processing failed:', error);
 toast.error('Failed to process import data');
 } finally {
 setIsProcessing(false);
 }
 }, [importData, importFormat, options]);

 // Create selected services
 const createServices = async () => {
 if (!importResult || selectedServices.size === 0) {
 toast.error('No services selected for creation');
 return;
 }

 setIsCreating(true);
 const servicesToCreate = importResult.services.filter((_, index) => 
 selectedServices.has(index) && importResult.services[index].status !== 'error'
 );

 let created = 0;
 let failed = 0;

 for (const service of servicesToCreate) {
 try {
 // Create the entity in Backstage
 const entity = {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: service.data.name,
 title: service.data.title,
 description: service.data.description,
 tags: service.data.tags,
 annotations: {
 'backstage.io/managed-by-location': service.data.repository.url || `url:https://github.com/company/${service.data.name}`,
 'github.com/project-slug': `company/${service.data.name}`,
 },
 },
 spec: {
 type: service.data.type,
 lifecycle: service.data.lifecycle,
 owner: service.data.owner,
 system: service.data.system,
 providesApis: service.data.providesApis,
 consumesApis: service.data.consumesApis,
 dependsOn: service.data.dependsOn,
 },
 };

 await backstageClient.createEntity(entity);
 created++;
 } catch (error) {
 // console.error(`Failed to create service ${service.name}:`, error);
 failed++;
 }
 }

 setIsCreating(false);
 
 if (created > 0) {
 toast.success(`Successfully created ${created} services`);
 }
 if (failed > 0) {
 toast.error(`Failed to create ${failed} services`);
 }

 if (created > 0 && failed === 0) {
 setTimeout(() => router.push('/catalog'), 2000);
 }
 };

 // Handle file upload
 const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onload = (e) => {
 const content = e.target?.result as string;
 setImportData(content);
 
 // Auto-detect format based on file extension
 const extension = file.name.split('.').pop()?.toLowerCase();
 if (extension === 'csv') setImportFormat('csv');
 else if (extension === 'json') setImportFormat('json');
 else if (extension === 'yaml' || extension === 'yml') setImportFormat('yaml');
 };
 reader.readAsText(file);
 };

 // Download template
 const downloadTemplate = () => {
 let content: string;
 let filename: string;
 let mimeType: string;

 switch (importFormat) {
 case 'csv':
 content = BulkImporter.generateCSVTemplate();
 filename = 'services-template.csv';
 mimeType = 'text/csv';
 break;
 case 'json':
 content = BulkImporter.generateJSONTemplate();
 filename = 'services-template.json';
 mimeType = 'application/json';
 break;
 case 'yaml':
 content = `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
 name: user-service
 title: User Service
 description: Handles user authentication and profile management
 tags:
 - backend
 - api
 - typescript
spec:
 type: service
 lifecycle: production
 owner: backend-team
 system: user-management
 providesApis:
 - user-api
 consumesApis:
 - auth-api
 dependsOn:
 - Component:default/auth-service`;
 filename = 'service-template.yaml';
 mimeType = 'text/yaml';
 break;
 default:
 return;
 }

 const blob = new Blob([content], { type: mimeType });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.click();
 URL.revokeObjectURL(url);
 toast.success('Template downloaded');
 };

 // Toggle service selection
 const toggleServiceSelection = (index: number) => {
 const newSelected = new Set(selectedServices);
 if (newSelected.has(index)) {
 newSelected.delete(index);
 } else {
 newSelected.add(index);
 }
 setSelectedServices(newSelected);
 };

 // Select all/none
 const selectAll = (select: boolean) => {
 if (select && importResult) {
 const validIndices = importResult.services
 .map((service, index) => service.status !== 'error' ? index : -1)
 .filter(index => index !== -1);
 setSelectedServices(new Set(validIndices));
 } else {
 setSelectedServices(new Set());
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'success': return 'text-green-600 dark:text-green-400';
 case 'warning': return 'text-yellow-600 dark:text-yellow-400';
 case 'error': return 'text-red-600 dark:text-red-400';
 default: return 'text-gray-600 dark:text-gray-400';
 }
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'success': return <CheckCircle2 className="w-4 h-4" />;
 case 'warning': return <AlertTriangle className="w-4 h-4" />;
 case 'error': return <AlertCircle className="w-4 h-4" />;
 default: return <AlertCircle className="w-4 h-4" />;
 }
 };

 return (
 <div className="max-w-6xl mx-auto">
 {/* Header */}
 <div className="mb-8">
 <button
 onClick={() => router.push('/create')}
 className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
 >
 <ArrowLeft className="w-4 h-4 mr-1" />
 Back to Service Creator
 </button>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Bulk Service Import
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Import multiple services from CSV, JSON, or YAML files
 </p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Import Configuration */}
 <div className="lg:col-span-1">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-4">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Import Configuration
 </h2>

 {/* Format Selection */}
 <div className="mb-6">
 <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Import Format
 </div>
 <div className="grid grid-cols-3 gap-2">
 {[
 { value: 'csv', label: 'CSV', icon: Database },
 { value: 'json', label: 'JSON', icon: FileCode },
 { value: 'yaml', label: 'YAML', icon: FileText },
 ].map(({ value, label, icon: Icon }) => (
 <button
 key={value}
 onClick={() => setImportFormat(value as ImportFormat)}
 className={`flex flex-col items-center p-3 rounded-md border transition-colors ${
 importFormat === value
 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
 : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
 }`}
 >
 <Icon className="w-5 h-5 mb-1" />
 <span className="text-xs font-medium">{label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Options */}
 <div className="mb-6">
 <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
 Import Options
 </div>
 <div className="space-y-3">
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={options.overwriteExisting}
 onChange={(e) => setOptions({ ...options, overwriteExisting: e.target.checked })}
 className="rounded border-input mr-2"
 />
 <span className="text-sm">Overwrite existing services</span>
 </label>
 
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={options.validateOnly}
 onChange={(e) => setOptions({ ...options, validateOnly: e.target.checked })}
 className="rounded border-input mr-2"
 />
 <span className="text-sm">Validate only (don&apos;t create)</span>
 </label>

 <label className="flex items-center">
 <input
 type="checkbox"
 checked={options.skipValidation}
 onChange={(e) => setOptions({ ...options, skipValidation: e.target.checked })}
 className="rounded border-input mr-2"
 />
 <span className="text-sm">Skip validation</span>
 </label>

 <div>
 <label htmlFor="default-owner" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
 Default Owner
 </label>
 <input
 id="default-owner"
 type="text"
 value={options.defaultOwner}
 onChange={(e) => setOptions({ ...options, defaultOwner: e.target.value })}
 placeholder="team-name"
 className="w-full px-2 py-1 text-sm rounded border border-input bg-background"
 />
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="space-y-3">
 <button
 onClick={downloadTemplate}
 className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
 >
 <Download className="w-4 h-4 mr-2" />
 Download Template
 </button>

 <div>
 <input
 type="file"
 onChange={handleFileUpload}
 accept=".csv,.json,.yaml,.yml"
 className="hidden"
 id="file-upload"
 />
 <label
 htmlFor="file-upload"
 className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
 >
 <Upload className="w-4 h-4 mr-2" />
 Upload File
 </label>
 </div>

 <button
 onClick={processImport}
 disabled={!importData.trim() || isProcessing}
 className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isProcessing ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
 <>
 <Settings className="w-4 h-4 mr-2" />
 Process Import
 </>
 )}
 </button>
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="lg:col-span-2 space-y-6">
 {/* Import Data Input */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Import Data
 </h3>
 <button
 onClick={() => setShowPreview(!showPreview)}
 className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
 >
 <Eye className="w-4 h-4 inline mr-1" />
 {showPreview ? 'Hide' : 'Show'} Preview
 </button>
 </div>
 </div>

 <div className="p-4">
 <MonacoEditor
 height="300px"
 language={importFormat === 'csv' ? 'plaintext' : importFormat}
 theme="vs-dark"
 value={importData}
 onChange={(value) => setImportData(value || '')}
 options={{
 minimap: { enabled: false },
 lineNumbers: 'on',
 scrollBeyondLastLine: false,
 wordWrap: 'on',
 }}
 />
 </div>
 </div>

 {/* Import Results */}
 {importResult && (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Import Results
 </h3>
 <div className="flex items-center gap-4 text-sm">
 <span className="text-green-600 dark:text-green-400">
 {importResult.summary.successful} successful
 </span>
 {importResult.summary.warnings > 0 && (
 <span className="text-yellow-600 dark:text-yellow-400">
 {importResult.summary.warnings} warnings
 </span>
 )}
 {importResult.summary.failed > 0 && (
 <span className="text-red-600 dark:text-red-400">
 {importResult.summary.failed} failed
 </span>
 )}
 </div>
 </div>
 </div>

 <div className="p-4">
 {/* Selection Controls */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <button
 onClick={() => selectAll(true)}
 className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
 >
 Select All
 </button>
 <button
 onClick={() => selectAll(false)}
 className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
 >
 Select None
 </button>
 </div>

 <button
 onClick={createServices}
 disabled={selectedServices.size === 0 || isCreating}
 className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isCreating ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Creating...
 </>
 ) : (
 <>
 <Play className="w-4 h-4 mr-2" />
 Create Selected ({selectedServices.size})
 </>
 )}
 </button>
 </div>

 {/* Services List */}
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {importResult.services.map((service, index) => (
 <div
 key={index}
 className={`flex items-center p-3 rounded-lg border transition-colors ${
 selectedServices.has(index)
 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
 : 'border-gray-200 dark:border-gray-700'
 }`}
 >
 <input
 type="checkbox"
 checked={selectedServices.has(index)}
 onChange={() => toggleServiceSelection(index)}
 disabled={service.status === 'error'}
 className="mr-3 rounded border-input"
 />

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className={`font-medium ${getStatusColor(service.status)}`}>
 {getStatusIcon(service.status)}
 </span>
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {service.name}
 </span>
 <span className="text-sm text-gray-500 dark:text-gray-400">
 ({service.data.type})
 </span>
 </div>
 
 {service.messages.length > 0 && (
 <div className="mt-1">
 {service.messages.map((message, msgIndex) => (
 <p key={msgIndex} className="text-xs text-gray-600 dark:text-gray-400">
 {message}
 </p>
 ))}
 </div>
 )}
 </div>

 <div className="text-right">
 <span className="text-xs text-gray-500 dark:text-gray-400">
 Row {service.originalIndex + 1}
 </span>
 </div>
 </div>
 ))}
 </div>

 {/* Import Errors */}
 {importResult.errors.length > 0 && (
 <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
 <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
 Import Errors
 </h4>
 <div className="space-y-1">
 {importResult.errors.map((error, index) => (
 <p key={index} className="text-sm text-red-700 dark:text-red-300">
 Row {error.row}: {error.message}
 </p>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

export default BulkImportPage;