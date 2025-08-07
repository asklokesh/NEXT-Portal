'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 ArrowLeft,
 Play,
 Star,
 Download,
 GitFork,
 Shield,
 Clock,
 Users,
 FileText,
 Code,
 Eye,
 ChevronRight,
 AlertCircle,
 CheckCircle,
 Package,
 Tag,
 Calendar,
 TrendingUp,
 BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';
import { 
 useTemplate, 
 useTemplateStats,
 useTasksByTemplate 
} from '@/services/backstage/hooks/useScaffolder';

import { TemplateExecutor } from '../TemplateExecution/TemplateExecutor';
import { TemplateParameterForm } from '../TemplatePreview/TemplateParameterForm';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateDetailsViewProps {
 templateRef: string;
 onBack?: () => void;
 className?: string;
}

type ViewMode = 'details' | 'parameters' | 'execute';

export const TemplateDetailsView: React.FC<TemplateDetailsViewProps> = ({
 templateRef,
 onBack,
 className,
}) => {
 const router = useRouter();
 const [viewMode, setViewMode] = useState<ViewMode>('details');
 const [parameters, setParameters] = useState<Record<string, any>>({});
 const [parameterErrors, setParameterErrors] = useState<Record<string, string>>({});

 // Fetch template data
 const { data: template, isLoading } = useTemplate(templateRef);
 const { data: stats } = useTemplateStats(templateRef);
 const { data: recentTasks } = useTasksByTemplate(templateRef, { limit: 5 });

 // Validate parameters
 const validateParameters = (): boolean => {
 if (!template) return false;

 const errors: Record<string, string> = {};
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;

 // Check required fields
 const required = params.required || [];
 for (const field of required) {
 if (!parameters[field]) {
 errors[field] = 'This field is required';
 }
 }

 setParameterErrors(errors);
 return Object.keys(errors).length === 0;
 };

 const handleUseTemplate = () => {
 setViewMode('parameters');
 };

 const handleExecute = () => {
 if (validateParameters()) {
 setViewMode('execute');
 }
 };

 const handleExecutionSuccess = () => {
 // Navigate to the created resource
 router.push(`/catalog/default/component/${parameters.name}`);
 };

 const handleCancel = () => {
 setViewMode('details');
 setParameters({});
 setParameterErrors({});
 };

 if (isLoading) {
 return (
 <div className={cn('flex items-center justify-center h-96', className)}>
 <div className="text-center">
 <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
 <p className="text-muted-foreground">Loading template...</p>
 </div>
 </div>
 );
 }

 if (!template) {
 return (
 <div className={cn('flex flex-col items-center justify-center h-96', className)}>
 <AlertCircle className="w-12 h-12 text-destructive mb-4" />
 <h3 className="text-lg font-semibold mb-2">Template not found</h3>
 <p className="text-sm text-muted-foreground mb-4">
 The template "{templateRef}" could not be loaded.
 </p>
 <button
 onClick={onBack}
 className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Templates
 </button>
 </div>
 );
 }

 // Execute view
 if (viewMode === 'execute') {
 return (
 <div className={cn('space-y-6', className)}>
 <div className="flex items-center justify-between">
 <h1 className="text-2xl font-bold">Execute Template</h1>
 <button
 onClick={handleCancel}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Template
 </button>
 </div>

 <TemplateExecutor
 templateRef={templateRef}
 parameters={parameters}
 onSuccess={handleExecutionSuccess}
 onCancel={handleCancel}
 />
 </div>
 );
 }

 // Parameters view
 if (viewMode === 'parameters') {
 return (
 <div className={cn('space-y-6', className)}>
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold">Configure {template.metadata.title}</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Fill in the parameters to create your new component
 </p>
 </div>
 <button
 onClick={() => setViewMode('details')}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Details
 </button>
 </div>

 <div className="bg-card rounded-lg border p-6">
 <TemplateParameterForm
 parameters={template.spec.parameters}
 values={parameters}
 onChange={setParameters}
 errors={parameterErrors}
 />

 <div className="flex items-center justify-between mt-8 pt-6 border-t">
 <button
 onClick={() => setViewMode('details')}
 className="px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 Cancel
 </button>

 <button
 onClick={handleExecute}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Play className="w-4 h-4" />
 Create Component
 </button>
 </div>
 </div>
 </div>
 );
 }

 // Details view
 return (
 <div className={cn('space-y-6', className)}>
 {/* Header */}
 <div className="bg-card rounded-lg border p-6">
 <div className="flex items-start justify-between mb-6">
 <div className="flex items-start gap-4">
 <div className="p-4 rounded-lg bg-primary/10">
 <Package className="w-8 h-8 text-primary" />
 </div>
 
 <div>
 <div className="flex items-center gap-2 mb-2">
 <h1 className="text-2xl font-bold">{template.metadata.title}</h1>
 {template.metadata.namespace === 'default' && (
 <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
 <Shield className="w-3 h-3" />
 <span>Official</span>
 </div>
 )}
 </div>
 
 <p className="text-muted-foreground mb-4">
 {template.metadata.description}
 </p>

 {/* Tags */}
 {template.metadata.tags && template.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {template.metadata.tags.map((tag) => (
 <span
 key={tag}
 className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground"
 >
 <Tag className="w-3 h-3" />
 {tag}
 </span>
 ))}
 </div>
 )}
 </div>
 </div>

 <button
 onClick={handleUseTemplate}
 className="flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Play className="w-5 h-5" />
 Use Template
 </button>
 </div>

 {/* Stats */}
 {stats && (
 <div className="grid grid-cols-4 gap-4 pt-6 border-t">
 <div className="text-center">
 <div className="flex items-center justify-center gap-1 text-2xl font-bold">
 <Download className="w-5 h-5" />
 {stats.totalExecutions}
 </div>
 <p className="text-sm text-muted-foreground">Total Uses</p>
 </div>
 
 <div className="text-center">
 <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-600">
 <CheckCircle className="w-5 h-5" />
 {stats.successfulExecutions}
 </div>
 <p className="text-sm text-muted-foreground">Successful</p>
 </div>
 
 <div className="text-center">
 <div className="flex items-center justify-center gap-1 text-2xl font-bold">
 <Clock className="w-5 h-5" />
 {Math.round(stats.averageExecutionTime / 1000)}s
 </div>
 <p className="text-sm text-muted-foreground">Avg. Time</p>
 </div>
 
 <div className="text-center">
 <div className="flex items-center justify-center gap-1 text-2xl font-bold">
 <TrendingUp className="w-5 h-5" />
 {Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)}%
 </div>
 <p className="text-sm text-muted-foreground">Success Rate</p>
 </div>
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Main content */}
 <div className="lg:col-span-2 space-y-6">
 {/* Steps */}
 <div className="bg-card rounded-lg border p-6">
 <h2 className="text-lg font-semibold mb-4">Template Steps</h2>
 <div className="space-y-3">
 {template.spec.steps.map((step, index) => (
 <div key={step.id} className="flex items-start gap-3">
 <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium flex-shrink-0">
 {index + 1}
 </div>
 <div>
 <h3 className="font-medium">{step.name}</h3>
 <p className="text-sm text-muted-foreground">
 Action: <code className="px-1 py-0.5 rounded bg-muted">{step.action}</code>
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Recent executions */}
 {recentTasks && recentTasks.length > 0 && (
 <div className="bg-card rounded-lg border">
 <div className="p-6 border-b">
 <h2 className="text-lg font-semibold">Recent Executions</h2>
 </div>
 <div className="divide-y">
 {recentTasks.map((task) => (
 <div key={task.id} className="p-4 hover:bg-accent/50 transition-colors">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium">
 {task.spec.parameters.name || 'Unnamed'}
 </p>
 <p className="text-sm text-muted-foreground">
 {new Date(task.createdAt).toLocaleString()}
 </p>
 </div>
 <div className={cn(
 'px-2 py-1 rounded-full text-xs font-medium',
 task.status === 'completed' && 'bg-green-100 text-green-700',
 task.status === 'failed' && 'bg-red-100 text-red-700',
 task.status === 'processing' && 'bg-blue-100 text-blue-700'
 )}>
 {task.status}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Sidebar */}
 <div className="space-y-6">
 {/* Template info */}
 <div className="bg-card rounded-lg border p-6">
 <h3 className="font-semibold mb-4">Template Information</h3>
 <dl className="space-y-3 text-sm">
 <div>
 <dt className="text-muted-foreground">Type</dt>
 <dd className="font-medium">{template.spec.type}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Owner</dt>
 <dd className="font-medium">{template.spec.owner}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Created</dt>
 <dd className="font-medium">
 {template.metadata.annotations?.['backstage.io/managed-by'] || 'Unknown'}
 </dd>
 </div>
 </dl>
 </div>

 {/* Actions */}
 <div className="bg-card rounded-lg border p-6">
 <h3 className="font-semibold mb-4">Actions</h3>
 <div className="space-y-2">
 <button className="w-full flex items-center justify-between p-3 rounded-md hover:bg-accent hover:text-accent-foreground text-left">
 <span className="flex items-center gap-2">
 <Eye className="w-4 h-4" />
 View Source
 </span>
 <ChevronRight className="w-4 h-4" />
 </button>
 <button className="w-full flex items-center justify-between p-3 rounded-md hover:bg-accent hover:text-accent-foreground text-left">
 <span className="flex items-center gap-2">
 <GitFork className="w-4 h-4" />
 Fork Template
 </span>
 <ChevronRight className="w-4 h-4" />
 </button>
 <button className="w-full flex items-center justify-between p-3 rounded-md hover:bg-accent hover:text-accent-foreground text-left">
 <span className="flex items-center gap-2">
 <FileText className="w-4 h-4" />
 View Documentation
 </span>
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Back button */}
 {onBack && (
 <div className="pt-6 border-t">
 <button
 onClick={onBack}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Templates
 </button>
 </div>
 )}
 </div>
 );
};