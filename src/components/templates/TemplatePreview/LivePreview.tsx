'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import, import/no-named-as-default */

import Editor from '@monaco-editor/react';
import { 
 Play, 
 RefreshCw, 
 FileText, 
 Code, 
 AlertCircle, 
 CheckCircle,
 ChevronRight,
 ChevronDown,
 Copy,
 Download,
 Eye,
 EyeOff,
 Zap,
 File,
 Folder,
 GitBranch,
 Terminal
} from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';

import type { Template, PreviewData, EditorFile } from '../types';

interface LivePreviewProps {
 template: Partial<Template>;
 parameters: Record<string, any>;
 onParameterChange: (parameters: Record<string, any>) => void;
 className?: string;
}

interface PreviewFileProps {
 file: {
 path: string;
 content: string;
 processed: boolean;
 };
 isExpanded: boolean;
 onToggle: () => void;
}

interface ParameterFormProps {
 parameters: Array<{
 title: string;
 required?: string[];
 properties: Record<string, any>;
 }>;
 values: Record<string, any>;
 onChange: (values: Record<string, any>) => void;
}

// Variable substitution engine
const substituteVariables = (
 content: string,
 values: Record<string, any>
): { content: string; variables: string[] } => {
 const variables: string[] = [];
 const variableRegex = /\{\{\s*([\w.]+)\s*\}\}/g;
 
 const processedContent = content.replace(variableRegex, (match, variable) => {
 variables.push(variable);
 
 // Handle nested properties
 const parts = variable.split('.');
 let value = values;
 
 for (const part of parts) {
 if (value && typeof value === 'object' && part in value) {
 value = value[part];
 } else {
 return match; // Keep original if not found
 }
 }
 
 return String(value);
 });

 return { content: processedContent, variables };
};

// Process conditional blocks
const processConditionals = (
 content: string,
 values: Record<string, any>
): string => {
 // Process if statements
 const ifRegex = /\{%\s*if\s+([\w.]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
 
 return content.replace(ifRegex, (match, condition, block) => {
 const parts = condition.split('.');
 let value = values;
 
 for (const part of parts) {
 if (value && typeof value === 'object' && part in value) {
 value = value[part];
 } else {
 return ''; // Remove block if condition not found
 }
 }
 
 // Evaluate condition
 if (value) {
 return block;
 }
 
 return '';
 });
};

// Preview file component
const PreviewFile: React.FC<PreviewFileProps> = ({ file, isExpanded, onToggle }) => {
 const [showRaw, setShowRaw] = useState(false);
 
 const fileIcon = file.path.includes('.') ? (
 <File className="w-4 h-4 text-muted-foreground" />
 ) : (
 <Folder className="w-4 h-4 text-blue-500" />
 );

 return (
 <div className="border border-border rounded-lg overflow-hidden">
 <div
 className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted"
 onClick={onToggle}
 >
 <button className="p-0.5">
 {isExpanded ? (
 <ChevronDown className="w-3 h-3" />
 ) : (
 <ChevronRight className="w-3 h-3" />
 )}
 </button>
 
 {fileIcon}
 
 <span className="flex-1 text-sm font-medium truncate">{file.path}</span>
 
 {file.processed && (
 <CheckCircle className="w-4 h-4 text-green-500" />
 )}
 </div>

 {isExpanded && (
 <div className="border-t border-border">
 <div className="flex items-center justify-between px-3 py-1 bg-muted/30">
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowRaw(!showRaw)}
 className={cn(
 'flex items-center gap-1 px-2 py-0.5 text-xs rounded',
 'hover:bg-accent hover:text-accent-foreground',
 showRaw && 'bg-accent text-accent-foreground'
 )}
 >
 {showRaw ? <Code className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
 {showRaw ? 'Raw' : 'Processed'}
 </button>
 </div>
 
 <div className="flex items-center gap-1">
 <button
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Copy content"
 >
 <Copy className="w-3 h-3" />
 </button>
 <button
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Download file"
 >
 <Download className="w-3 h-3" />
 </button>
 </div>
 </div>
 
 <div className="max-h-96 overflow-auto">
 <Editor
 height="300px"
 language={file.path.endsWith('.json') ? 'json' : 'plaintext'}
 value={file.content}
 theme="vs-dark"
 options={{
 readOnly: true,
 minimap: { enabled: false },
 scrollBeyondLastLine: false,
 wordWrap: 'on',
 fontSize: 12,
 }}
 />
 </div>
 </div>
 )}
 </div>
 );
};

// Parameter form component
const ParameterForm: React.FC<ParameterFormProps> = ({
 parameters,
 values,
 onChange,
}) => {
 const handleFieldChange = (fieldName: string, value: any) => {
 onChange({
 ...values,
 [fieldName]: value,
 });
 };

 const renderField = (name: string, field: any) => {
 const value = values[name] || field.default || '';

 switch (field.type) {
 case 'string':
 if (field.enum) {
 return (
 <select
 value={value}
 onChange={(e) => handleFieldChange(name, e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="">Select...</option>
 {field.enum.map((option: string, index: number) => (
 <option key={option} value={option}>
 {field.enumNames?.[index] || option}
 </option>
 ))}
 </select>
 );
 }
 
 if (field['ui:widget'] === 'textarea') {
 return (
 <textarea
 value={value}
 onChange={(e) => handleFieldChange(name, e.target.value)}
 placeholder={field['ui:placeholder'] || field.description}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 rows={3}
 />
 );
 }
 
 return (
 <input
 type={field['ui:widget'] === 'password' ? 'password' : 'text'}
 value={value}
 onChange={(e) => handleFieldChange(name, e.target.value)}
 placeholder={field['ui:placeholder'] || field.description}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 );

 case 'number':
 return (
 <input
 type="number"
 value={value}
 onChange={(e) => handleFieldChange(name, parseFloat(e.target.value) || 0)}
 placeholder={field['ui:placeholder'] || field.description}
 min={field.minimum}
 max={field.maximum}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 );

 case 'boolean':
 return (
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id={name}
 checked={value}
 onChange={(e) => handleFieldChange(name, e.target.checked)}
 className="rounded border-input"
 />
 <label htmlFor={name} className="text-sm">
 {field.description || 'Enable'}
 </label>
 </div>
 );

 case 'array':
 // Simplified array input
 return (
 <textarea
 value={Array.isArray(value) ? value.join(', ') : ''}
 onChange={(e) => handleFieldChange(
 name,
 e.target.value.split(',').map(s => s.trim()).filter(Boolean)
 )}
 placeholder="Enter comma-separated values"
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 rows={2}
 />
 );

 default:
 return <div className="text-sm text-muted-foreground">Unsupported field type</div>;
 }
 };

 return (
 <div className="space-y-6">
 {parameters.map((section, sectionIndex) => (
 <div key={sectionIndex} className="space-y-4">
 <h3 className="font-medium text-sm text-muted-foreground">{section.title}</h3>
 
 {Object.entries(section.properties).map(([fieldName, field]: [string, any]) => {
 const isRequired = section.required?.includes(fieldName);
 
 return (
 <div key={fieldName} className="space-y-2">
 <label className="block text-sm font-medium">
 {field.title}
 {isRequired && <span className="text-destructive ml-1">*</span>}
 {field['ui:help'] && (
 <span className="ml-2 text-xs text-muted-foreground">
 {field['ui:help']}
 </span>
 )}
 </label>
 {renderField(fieldName, field)}
 </div>
 );
 })}
 </div>
 ))}
 </div>
 );
};

// Main live preview component
export const LivePreview: React.FC<LivePreviewProps> = ({
 template,
 parameters,
 onParameterChange,
 className,
}) => {
 const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
 const [isProcessing, setIsProcessing] = useState(false);
 const [previewMode, setPreviewMode] = useState<'split' | 'preview'>('split');

 // Process template files
 const processedFiles = useMemo(() => {
 if (!template.spec) return [];

 // Mock template files for demo
 const templateFiles = [
 {
 path: 'package.json',
 content: `{
 "name": "{{ values.name }}",
 "version": "1.0.0",
 "description": "{{ values.description }}",
 "author": "{{ values.owner }}",
 "license": "MIT",
 "scripts": {
 "dev": "next dev",
 "build": "next build",
 "start": "next start"
 },
 "dependencies": {
 {% if values.framework == "nextjs" %}
 "next": "^14.0.0",
 "react": "^18.2.0",
 "react-dom": "^18.2.0"
 {% endif %}
 }
}`,
 },
 {
 path: 'README.md',
 content: `# {{ values.title }}

{{ values.description }}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Owner

This project is maintained by {{ values.owner }}.

{% if values.includeDocker %}
## Docker

This project includes Docker support. To run:

\`\`\`bash
docker build -t {{ values.name }} .
docker run -p 3000:3000 {{ values.name }}
\`\`\`
{% endif %}`,
 },
 {
 path: 'src/index.ts',
 content: `// {{ values.title }}
// {{ values.description }}

export function main() {
 console.log('Hello from {{ values.name }}!');
}

{% if values.includeTests %}
// Run tests with: npm test
{% endif %}`,
 },
 ];

 return templateFiles.map((file) => {
 let processedContent = file.content;
 
 // Process conditionals first
 processedContent = processConditionals(processedContent, { values: parameters });
 
 // Then substitute variables
 const { content } = substituteVariables(processedContent, { values: parameters });
 
 return {
 path: file.path,
 content,
 processed: true,
 };
 });
 }, [template, parameters]);

 // Toggle file expansion
 const toggleFile = (path: string) => {
 const newExpanded = new Set(expandedFiles);
 if (newExpanded.has(path)) {
 newExpanded.delete(path);
 } else {
 newExpanded.add(path);
 }
 setExpandedFiles(newExpanded);
 };

 // Run preview
 const runPreview = useCallback(async () => {
 setIsProcessing(true);
 // Simulate processing delay
 await new Promise(resolve => setTimeout(resolve, 1000));
 setIsProcessing(false);
 }, []);

 return (
 <div className={cn('flex h-full', className)}>
 {/* Parameter form */}
 {previewMode === 'split' && (
 <div className="w-96 flex-shrink-0 border-r border-border bg-muted/50">
 <div className="p-4 border-b border-border">
 <h3 className="font-semibold">Test Parameters</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Fill in sample values to preview the generated output
 </p>
 </div>
 
 <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
 {template.spec?.parameters && (
 <ParameterForm
 parameters={template.spec.parameters}
 values={parameters}
 onChange={onParameterChange}
 />
 )}
 </div>
 
 <div className="p-4 border-t border-border">
 <button
 onClick={runPreview}
 disabled={isProcessing}
 className={cn(
 'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md',
 'bg-primary text-primary-foreground hover:bg-primary/90',
 'disabled:opacity-50 transition-colors'
 )}
 >
 {isProcessing ? (
 <>
 <RefreshCw className="w-4 h-4 animate-spin" />
 Processing...
 </>
 ) : (
 <>
 <Play className="w-4 h-4" />
 Run Preview
 </>
 )}
 </button>
 </div>
 </div>
 )}

 {/* Preview output */}
 <div className="flex-1 flex flex-col">
 <div className="flex items-center justify-between p-4 border-b border-border">
 <div className="flex items-center gap-2">
 <Zap className="w-5 h-5 text-primary" />
 <h3 className="font-semibold">Preview Output</h3>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={() => setPreviewMode(previewMode === 'split' ? 'preview' : 'split')}
 className="flex items-center gap-2 px-3 py-1 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
 >
 {previewMode === 'split' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 {previewMode === 'split' ? 'Hide Form' : 'Show Form'}
 </button>
 
 <button
 className="flex items-center gap-2 px-3 py-1 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
 title="Download all files"
 >
 <Download className="w-4 h-4" />
 Download ZIP
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {processedFiles.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-center">
 <FileText className="w-12 h-12 text-muted-foreground mb-4" />
 <h4 className="font-medium mb-2">No Template Files</h4>
 <p className="text-sm text-muted-foreground max-w-md">
 Add template files in the File Editor to see the preview output here.
 </p>
 </div>
 ) : (
 processedFiles.map((file) => (
 <PreviewFile
 key={file.path}
 file={file}
 isExpanded={expandedFiles.has(file.path)}
 onToggle={() => toggleFile(file.path)}
 />
 ))
 )}
 </div>

 {/* Actions that would be executed */}
 {template.spec?.steps && template.spec.steps.length > 0 && (
 <div className="p-4 border-t border-border bg-muted/50">
 <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
 <Terminal className="w-4 h-4" />
 Actions to Execute
 </h4>
 <div className="space-y-1">
 {template.spec.steps.map((step, index) => (
 <div key={step.id} className="flex items-center gap-2 text-xs">
 <span className="text-muted-foreground">{index + 1}.</span>
 <code className="px-2 py-0.5 rounded bg-background">
 {step.action}
 </code>
 <span className="text-muted-foreground">{step.name}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 );
};