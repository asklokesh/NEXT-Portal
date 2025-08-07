'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Play,
 CheckCircle,
 XCircle,
 AlertCircle,
 Loader2,
 ExternalLink,
 ChevronRight,
 Terminal,
 Clock,
 RotateCcw,
 FileText,
 GitBranch,
 Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';
import { 
 useTemplate,
 useExecuteTemplate,
 useTaskProgress,
 useTaskLogStream,
 useDryRunTemplate
} from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity, Task, TemplateParameters } from '@/services/backstage/types/templates';

interface TemplateExecutorProps {
 templateRef: string;
 parameters: Record<string, any>;
 onSuccess?: (task: Task) => void;
 onCancel?: () => void;
 className?: string;
}

interface ExecutionStep {
 id: string;
 name: string;
 status: 'pending' | 'running' | 'completed' | 'failed';
 logs: Array<{ body: string; level: string; timestamp: string }>;
}

export const TemplateExecutor: React.FC<TemplateExecutorProps> = ({
 templateRef,
 parameters,
 onSuccess,
 onCancel,
 className,
}) => {
 const router = useRouter();
 const [executionState, setExecutionState] = useState<'preview' | 'dry-run' | 'executing' | 'completed' | 'failed'>('preview');
 const [taskId, setTaskId] = useState<string | null>(null);
 const [steps, setSteps] = useState<ExecutionStep[]>([]);
 const [logs, setLogs] = useState<Array<{ body: string; level: string; timestamp: string }>>([]);
 const [outputLinks, setOutputLinks] = useState<Array<{ title: string; url: string; icon?: React.ReactNode }>>([]);

 // Fetch template data
 const { data: template, isLoading: isLoadingTemplate } = useTemplate(templateRef);
 
 // Mutations
 const executeTemplate = useExecuteTemplate({
 onSuccess: (data) => {
 setTaskId(data.taskId);
 setExecutionState('executing');
 },
 onError: (error) => {
 console.error('Failed to execute template:', error);
 setExecutionState('failed');
 },
 });

 const dryRunTemplate = useDryRunTemplate({
 onSuccess: (data) => {
 // Show dry run results
 const mockSteps = data.steps.map((step, index) => ({
 id: step.id,
 name: step.name,
 status: 'completed' as const,
 logs: data.log
 .filter(log => log.body.includes(step.name))
 .map(log => ({
 body: log.body,
 level: log.level,
 timestamp: new Date().toISOString(),
 })),
 }));
 setSteps(mockSteps);
 },
 onError: (error) => {
 console.error('Dry run failed:', error);
 },
 });

 // Task progress tracking
 const { task, progress, isCompleted, isFailed } = useTaskProgress(taskId || '');

 // Stream logs
 useTaskLogStream(taskId || '', {
 enabled: !!taskId && executionState === 'executing',
 onLog: (log) => {
 setLogs(prev => [...prev, {
 body: log.body,
 level: log.level,
 timestamp: log.createdAt,
 }]);

 // Update step status based on logs
 if (task?.steps) {
 const updatedSteps = task.steps.map((step, index) => ({
 id: step.id,
 name: step.name,
 status: step.status === 'completed' ? 'completed' : 
 step.status === 'failed' ? 'failed' : 
 step.status === 'processing' ? 'running' : 'pending',
 logs: logs.filter(l => l.body.includes(step.name)),
 } as ExecutionStep));
 setSteps(updatedSteps);
 }
 },
 });

 // Check task completion
 React.useEffect(() => {
 if (isCompleted && task) {
 setExecutionState('completed');
 
 // Extract output links from task
 const links: Array<{ title: string; url: string; icon?: React.ReactNode }> = [];
 
 // Mock output links - in real implementation, extract from task.output
 links.push({
 title: 'Repository',
 url: `https://github.com/company/${parameters.name}`,
 icon: <GitBranch className="w-4 h-4" />,
 });
 
 links.push({
 title: 'Service Catalog',
 url: `/catalog/default/component/${parameters.name}`,
 icon: <Package className="w-4 h-4" />,
 });
 
 if (parameters.enableDocs) {
 links.push({
 title: 'Documentation',
 url: `https://docs.company.com/${parameters.name}`,
 icon: <FileText className="w-4 h-4" />,
 });
 }
 
 setOutputLinks(links);
 onSuccess?.(task);
 }

 if (isFailed) {
 setExecutionState('failed');
 }
 }, [isCompleted, isFailed, task, parameters, onSuccess]);

 const handleExecute = () => {
 executeTemplate.mutate({
 templateRef,
 values: parameters,
 });
 };

 const handleDryRun = () => {
 setExecutionState('dry-run');
 dryRunTemplate.mutate({
 templateRef,
 values: parameters,
 });
 };

 const handleRetry = () => {
 setExecutionState('preview');
 setTaskId(null);
 setSteps([]);
 setLogs([]);
 setOutputLinks([]);
 };

 if (isLoadingTemplate) {
 return (
 <div className={cn('flex items-center justify-center h-64', className)}>
 <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
 </div>
 );
 }

 if (!template) {
 return (
 <div className={cn('flex flex-col items-center justify-center h-64 text-center', className)}>
 <AlertCircle className="w-12 h-12 text-destructive mb-4" />
 <h3 className="font-semibold mb-2">Template not found</h3>
 <p className="text-sm text-muted-foreground">
 The template "{templateRef}" could not be loaded.
 </p>
 </div>
 );
 }

 // Preview state
 if (executionState === 'preview') {
 return (
 <div className={cn('space-y-6', className)}>
 <div className="bg-card rounded-lg border p-6">
 <h3 className="text-lg font-semibold mb-4">Review Template Execution</h3>
 
 <div className="space-y-4">
 <div>
 <h4 className="font-medium mb-2">Template</h4>
 <p className="text-sm text-muted-foreground">{template.metadata.title}</p>
 </div>

 <div>
 <h4 className="font-medium mb-2">Parameters</h4>
 <div className="bg-muted/50 rounded-md p-4">
 <pre className="text-sm overflow-x-auto">
 {JSON.stringify(parameters, null, 2)}
 </pre>
 </div>
 </div>

 <div>
 <h4 className="font-medium mb-2">What will be created</h4>
 <ul className="space-y-2 text-sm text-muted-foreground">
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-green-600" />
 New repository in GitHub
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-green-600" />
 Service registration in catalog
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-green-600" />
 CI/CD pipelines configuration
 </li>
 {parameters.enableDocs && (
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-green-600" />
 Documentation site setup
 </li>
 )}
 </ul>
 </div>
 </div>

 <div className="flex items-center justify-between mt-6">
 <button
 onClick={onCancel}
 className="px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 Cancel
 </button>
 
 <div className="flex items-center gap-2">
 <button
 onClick={handleDryRun}
 className="px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 Dry Run
 </button>
 <button
 onClick={handleExecute}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Play className="w-4 h-4" />
 Execute Template
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 }

 // Execution states
 return (
 <div className={cn('space-y-6', className)}>
 {/* Progress header */}
 <div className="bg-card rounded-lg border p-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold">
 {executionState === 'dry-run' && 'Dry Run Results'}
 {executionState === 'executing' && 'Executing Template'}
 {executionState === 'completed' && 'Execution Complete'}
 {executionState === 'failed' && 'Execution Failed'}
 </h3>
 
 {executionState === 'executing' && (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <Clock className="w-4 h-4" />
 <span>{progress.percentage}% complete</span>
 </div>
 )}
 </div>

 {/* Progress bar */}
 {(executionState === 'executing' || executionState === 'dry-run') && (
 <div className="w-full bg-secondary rounded-full h-2 mb-4">
 <div 
 className="bg-primary h-2 rounded-full transition-all duration-500"
 style={{ width: `${progress.percentage}%` }}
 />
 </div>
 )}

 {/* Steps */}
 <div className="space-y-2">
 {steps.map((step, index) => (
 <div 
 key={step.id}
 className={cn(
 'flex items-center gap-3 p-3 rounded-md',
 step.status === 'completed' && 'bg-green-50 text-green-900',
 step.status === 'running' && 'bg-blue-50 text-blue-900',
 step.status === 'failed' && 'bg-red-50 text-red-900',
 step.status === 'pending' && 'bg-muted/50 text-muted-foreground'
 )}
 >
 {step.status === 'completed' && <CheckCircle className="w-5 h-5" />}
 {step.status === 'running' && <Loader2 className="w-5 h-5 animate-spin" />}
 {step.status === 'failed' && <XCircle className="w-5 h-5" />}
 {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-current" />}
 
 <span className="flex-1 font-medium">{step.name}</span>
 
 {step.status === 'running' && (
 <span className="text-xs">In progress...</span>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Logs */}
 {logs.length > 0 && (
 <div className="bg-card rounded-lg border">
 <div className="flex items-center gap-2 p-4 border-b">
 <Terminal className="w-5 h-5" />
 <h4 className="font-medium">Execution Logs</h4>
 </div>
 <div className="p-4 bg-black text-green-400 font-mono text-sm max-h-64 overflow-y-auto">
 {logs.map((log, index) => (
 <div key={index} className={cn(
 'mb-1',
 log.level === 'error' && 'text-red-400',
 log.level === 'warn' && 'text-yellow-400'
 )}>
 [{new Date(log.timestamp).toLocaleTimeString()}] {log.body}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Success output */}
 {executionState === 'completed' && outputLinks.length > 0 && (
 <div className="bg-green-50 border border-green-200 rounded-lg p-6">
 <div className="flex items-center gap-2 mb-4">
 <CheckCircle className="w-6 h-6 text-green-600" />
 <h4 className="text-lg font-semibold text-green-900">
 Template executed successfully!
 </h4>
 </div>
 
 <p className="text-sm text-green-800 mb-4">
 Your new {parameters.name} has been created. Here are the resources:
 </p>

 <div className="space-y-2">
 {outputLinks.map((link, index) => (
 <a
 key={index}
 href={link.url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-2 p-3 rounded-md bg-white hover:bg-green-100 transition-colors"
 >
 {link.icon}
 <span className="flex-1 font-medium">{link.title}</span>
 <ExternalLink className="w-4 h-4" />
 </a>
 ))}
 </div>
 </div>
 )}

 {/* Error state */}
 {executionState === 'failed' && (
 <div className="bg-red-50 border border-red-200 rounded-lg p-6">
 <div className="flex items-center gap-2 mb-4">
 <XCircle className="w-6 h-6 text-red-600" />
 <h4 className="text-lg font-semibold text-red-900">
 Execution failed
 </h4>
 </div>
 
 <p className="text-sm text-red-800 mb-4">
 The template execution encountered an error. Check the logs above for details.
 </p>

 <button
 onClick={handleRetry}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
 >
 <RotateCcw className="w-4 h-4" />
 Retry Execution
 </button>
 </div>
 )}

 {/* Actions */}
 <div className="flex items-center justify-between">
 <button
 onClick={onCancel}
 className="px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 {executionState === 'completed' ? 'Close' : 'Cancel'}
 </button>

 {executionState === 'completed' && (
 <button
 onClick={() => router.push(`/catalog/default/component/${parameters.name}`)}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 View in Catalog
 <ChevronRight className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 );
};