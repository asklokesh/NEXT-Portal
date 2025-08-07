'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { dump as yamlStringify } from 'js-yaml';
import { 
 Eye, 
 FileText, 
 Download, 
 Copy, 
 CheckCircle, 
 AlertTriangle, 
 AlertCircle,
 RefreshCw,
 Settings,
 Brackets
} from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';

import { useFormBuilderStore } from '../store/formBuilderStore';

import type { FormField, ValidationResult } from '../types';

interface PreviewPaneProps {
 className?: string;
}

interface CodeBlockProps {
 code: string;
 language: 'yaml' | 'json';
 title: string;
}

interface ValidationDisplayProps {
 validation: ValidationResult;
}

interface StatsDisplayProps {
 fields: FormField[];
}

// Code block component with syntax highlighting placeholder
const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, title }) => {
 const [copied, setCopied] = useState(false);

 const handleCopy = useCallback(async () => {
 try {
 await navigator.clipboard.writeText(code);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 } catch (err) {
 console.error('Failed to copy:', err);
 }
 }, [code]);

 const handleDownload = useCallback(() => {
 const blob = new Blob([code], { type: 'text/plain' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `backstage-entity.${language}`;
 a.click();
 URL.revokeObjectURL(url);
 }, [code, language]);

 return (
 <div className="border border-border rounded-lg overflow-hidden">
 <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
 <div className="flex items-center gap-2">
 {language === 'yaml' ? (
 <FileText className="w-4 h-4 text-muted-foreground" />
 ) : (
 <Brackets className="w-4 h-4 text-muted-foreground" />
 )}
 <span className="text-sm font-medium text-foreground">{title}</span>
 <span className="text-xs text-muted-foreground uppercase">{language}</span>
 </div>
 
 <div className="flex items-center gap-1">
 <button
 onClick={handleCopy}
 className={cn(
 'p-1 rounded hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 copied && 'text-green-600'
 )}
 title="Copy to clipboard"
 >
 {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
 </button>
 
 <button
 onClick={handleDownload}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
 title={`Download ${language.toUpperCase()}`}
 >
 <Download className="w-4 h-4" />
 </button>
 </div>
 </div>
 
 <div className="relative">
 <pre className={cn(
 'p-4 text-xs font-mono overflow-auto',
 'bg-background text-foreground',
 'max-h-96'
 )}>
 <code>{code}</code>
 </pre>
 </div>
 </div>
 );
};

// Validation display component
const ValidationDisplay: React.FC<ValidationDisplayProps> = ({ validation }) => {
 const hasErrors = validation.errors.length > 0;
 const hasWarnings = validation.warnings.length > 0;

 if (!hasErrors && !hasWarnings) {
 return (
 <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
 <CheckCircle className="w-4 h-4 text-green-600" />
 <span className="text-sm text-green-800">All fields valid</span>
 </div>
 );
 }

 return (
 <div className="space-y-2">
 {hasErrors && (
 <div className="border border-red-200 rounded-lg">
 <div className="flex items-center gap-2 p-3 bg-red-50 border-b border-red-200">
 <AlertCircle className="w-4 h-4 text-red-600" />
 <span className="text-sm font-medium text-red-800">
 {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
 </span>
 </div>
 <div className="p-3 space-y-2">
 {validation.errors.map((error, index) => (
 <div key={index} className="text-sm text-red-700">
 <span className="font-medium">{error.fieldPath}:</span> {error.message}
 </div>
 ))}
 </div>
 </div>
 )}

 {hasWarnings && (
 <div className="border border-yellow-200 rounded-lg">
 <div className="flex items-center gap-2 p-3 bg-yellow-50 border-b border-yellow-200">
 <AlertTriangle className="w-4 h-4 text-yellow-600" />
 <span className="text-sm font-medium text-yellow-800">
 {validation.warnings.length} Warning{validation.warnings.length !== 1 ? 's' : ''}
 </span>
 </div>
 <div className="p-3 space-y-2">
 {validation.warnings.map((warning, index) => (
 <div key={index} className="text-sm text-yellow-700">
 <span className="font-medium">{warning.fieldPath}:</span> {warning.message}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

// Stats display component
const StatsDisplay: React.FC<StatsDisplayProps> = ({ fields }) => {
 const stats = useMemo(() => {
 const fieldTypes = fields.reduce((acc, field) => {
 acc[field.type] = (acc[field.type] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 const requiredFields = fields.filter(f => f.required || f.validation?.required).length;
 const backstageMappedFields = fields.filter(f => f.backstageMapping).length;

 return {
 total: fields.length,
 required: requiredFields,
 mapped: backstageMappedFields,
 types: fieldTypes,
 };
 }, [fields]);

 return (
 <div className="space-y-3">
 <div className="grid grid-cols-3 gap-3">
 <div className="text-center p-3 bg-primary/5 border border-primary/20 rounded-lg">
 <div className="text-lg font-semibold text-primary">{stats.total}</div>
 <div className="text-xs text-muted-foreground">Total Fields</div>
 </div>
 
 <div className="text-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
 <div className="text-lg font-semibold text-orange-600">{stats.required}</div>
 <div className="text-xs text-muted-foreground">Required</div>
 </div>
 
 <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
 <div className="text-lg font-semibold text-blue-600">{stats.mapped}</div>
 <div className="text-xs text-muted-foreground">Mapped</div>
 </div>
 </div>

 {Object.keys(stats.types).length > 0 && (
 <div className="border border-border rounded-lg p-3">
 <h4 className="text-sm font-medium text-foreground mb-2">Field Types</h4>
 <div className="space-y-1">
 {Object.entries(stats.types).map(([type, count]) => (
 <div key={type} className="flex justify-between items-center text-xs">
 <span className="text-muted-foreground capitalize">{type}</span>
 <span className="font-medium text-foreground">{count}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

// Main preview pane component
export const PreviewPane: React.FC<PreviewPaneProps> = ({ className }) => {
 const [activeTab, setActiveTab] = useState<'preview' | 'yaml' | 'json' | 'stats'>('preview');
 const [autoRefresh, setAutoRefresh] = useState(true);
 const [refreshKey, setRefreshKey] = useState(0);

 const { 
 fields, 
 validateForm, 
 generatePreview,
 mode: _mode 
 } = useFormBuilderStore();

 // Generate preview data
 const previewData = useMemo(() => {
 try {
 return generatePreview();
 } catch (error) {
 console.error('Preview generation failed:', error);
 return {
 yaml: '# Error generating preview',
 json: { error: 'Preview generation failed' },
 backstageEntity: { error: 'Preview generation failed' }
 };
 }
 }, [generatePreview, refreshKey]);

 // Validate form
 const validation = useMemo(() => {
 return validateForm();
 }, [validateForm, refreshKey]);

 // Auto-refresh when fields change
 React.useEffect(() => {
 if (autoRefresh) {
 setRefreshKey(prev => prev + 1);
 }
 }, [fields, autoRefresh]);

 const handleManualRefresh = useCallback(() => {
 setRefreshKey(prev => prev + 1);
 }, []);

 const generateYamlOutput = useCallback(() => {
 try {
 if (!previewData.backstageEntity) {
 return '# No data to display';
 }

 return yamlStringify(previewData.backstageEntity, {
 indent: 2,
 lineWidth: 80,
 quotingType: '"'
 });
 } catch (error) {
 return `# Error generating YAML: ${error}`;
 }
 }, [previewData]);

 const generateJsonOutput = useCallback(() => {
 try {
 if (!previewData.backstageEntity) {
 return '{}';
 }

 return JSON.stringify(previewData.backstageEntity, null, 2);
 } catch (error) {
 return `{"error": "Error generating JSON: ${error}"}`;
 }
 }, [previewData]);

 if (fields.length === 0) {
 return (
 <div className={cn('flex flex-col h-full bg-background border-l border-border', className)}>
 <div className="p-4 border-b border-border">
 <h2 className="text-lg font-semibold text-foreground">Preview</h2>
 </div>
 
 <div className="flex-1 flex items-center justify-center p-8">
 <div className="text-center">
 <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
 <h3 className="text-sm font-medium text-foreground mb-2">
 No Fields to Preview
 </h3>
 <p className="text-xs text-muted-foreground">
 Add fields to the canvas to see the generated Backstage entity.
 </p>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className={cn('flex flex-col h-full bg-background border-l border-border', className)}>
 {/* Header */}
 <div className="p-4 border-b border-border">
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-lg font-semibold text-foreground">Preview</h2>
 
 <div className="flex items-center gap-2">
 <button
 onClick={() => setAutoRefresh(!autoRefresh)}
 className={cn(
 'flex items-center gap-1 px-2 py-1 text-xs rounded border',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 autoRefresh ? 'border-primary text-primary' : 'border-border text-muted-foreground'
 )}
 title="Auto refresh preview"
 >
 <RefreshCw className={cn(
 'w-3 h-3',
 autoRefresh && 'animate-spin'
 )} />
 Auto
 </button>
 
 {!autoRefresh && (
 <button
 onClick={handleManualRefresh}
 className={cn(
 'p-1 rounded hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200'
 )}
 title="Refresh preview"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 
 {/* Tabs */}
 <div className="flex rounded-md bg-muted p-1">
 {[
 { id: 'preview', label: 'Live Preview', icon: Eye },
 { id: 'yaml', label: 'YAML', icon: FileText },
 { id: 'json', label: 'JSON', icon: Brackets },
 { id: 'stats', label: 'Stats', icon: Settings },
 ].map((tab) => {
 const IconComponent = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={cn(
 'flex-1 flex items-center justify-center gap-1 px-3 py-1 text-sm font-medium rounded-sm transition-colors',
 activeTab === tab.id
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 )}
 >
 <IconComponent className="w-4 h-4" />
 <span className="hidden sm:inline">{tab.label}</span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {activeTab === 'preview' && (
 <div className="space-y-4">
 {/* Validation Status */}
 <ValidationDisplay validation={validation} />
 
 {/* Live Preview */}
 <div className="space-y-3">
 <h3 className="text-sm font-medium text-foreground">Entity Preview</h3>
 <div className="border border-border rounded-lg p-4 bg-muted/30">
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <span className="text-xs font-mono text-muted-foreground">apiVersion:</span>
 <span className="text-xs font-mono text-foreground">backstage.io/v1alpha1</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs font-mono text-muted-foreground">kind:</span>
 <span className="text-xs font-mono text-foreground">Component</span>
 </div>
 
 {fields.filter(f => f.backstageMapping?.startsWith('metadata.')).length > 0 && (
 <div className="pl-2 border-l-2 border-border space-y-2">
 <div className="text-xs font-mono text-muted-foreground">metadata:</div>
 {fields
 .filter(f => f.backstageMapping?.startsWith('metadata.'))
 .map(field => (
 <div key={field.id} className="pl-2 flex items-center gap-2">
 <span className="text-xs font-mono text-muted-foreground">
 {field.backstageMapping?.replace('metadata.', '')}:
 </span>
 <span className="text-xs font-mono text-foreground">
 {field.defaultValue?.toString() || `"${field.placeholder || field.label}"`}
 </span>
 </div>
 ))}
 </div>
 )}
 
 {fields.filter(f => f.backstageMapping?.startsWith('spec.')).length > 0 && (
 <div className="pl-2 border-l-2 border-border space-y-2">
 <div className="text-xs font-mono text-muted-foreground">spec:</div>
 {fields
 .filter(f => f.backstageMapping?.startsWith('spec.'))
 .map(field => (
 <div key={field.id} className="pl-2 flex items-center gap-2">
 <span className="text-xs font-mono text-muted-foreground">
 {field.backstageMapping?.replace('spec.', '')}:
 </span>
 <span className="text-xs font-mono text-foreground">
 {field.defaultValue?.toString() || `"${field.placeholder || field.label}"`}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'yaml' && (
 <CodeBlock
 code={generateYamlOutput()}
 language="yaml"
 title="Backstage Entity YAML"
 />
 )}

 {activeTab === 'json' && (
 <CodeBlock
 code={generateJsonOutput()}
 language="json"
 title="Backstage Entity JSON"
 />
 )}

 {activeTab === 'stats' && (
 <div className="space-y-4">
 <h3 className="text-sm font-medium text-foreground">Form Statistics</h3>
 <StatsDisplay fields={fields} />
 
 <div className="space-y-3">
 <h4 className="text-sm font-medium text-foreground">Validation Summary</h4>
 <ValidationDisplay validation={validation} />
 </div>
 </div>
 )}
 </div>
 </div>
 );
};