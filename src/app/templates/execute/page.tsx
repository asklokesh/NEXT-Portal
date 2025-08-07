'use client';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-floating-promises, react-hooks/exhaustive-deps, @typescript-eslint/require-await, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { motion } from 'framer-motion';
import {
 ArrowLeft,
 CheckCircle,
 AlertCircle,
 Clock,
 ExternalLink,
 GitBranch,
 Package,
 Loader,
 RefreshCw
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, Suspense } from 'react';
import { toast } from 'react-hot-toast';

// Removed direct import of backstageService to avoid Node.js dependencies in client
// Using API routes instead

import type { TemplateEntityV1beta3 } from '@/lib/backstage/types';

interface ExecutionStep {
 id: string;
 name: string;
 status: 'pending' | 'running' | 'completed' | 'failed';
 output?: string;
 error?: string;
 startTime?: string;
 endTime?: string;
}

interface TemplateExecution {
 id: string;
 templateRef: string;
 status: 'pending' | 'running' | 'completed' | 'failed';
 steps: ExecutionStep[];
 output?: {
 entityRef?: string;
 repoUrl?: string;
 links?: Array<{
 title: string;
 url: string;
 icon?: string;
 }>;
 };
 createdAt: string;
 completedAt?: string;
}

const TemplateExecutePage = () => {
 const router = useRouter();
 const searchParams = useSearchParams();
 const templateRef = searchParams.get('template');
 const taskId = searchParams.get('taskId');

 // State
 const [template, setTemplate] = useState<TemplateEntityV1beta3 | null>(null);
 const [execution, setExecution] = useState<TemplateExecution | null>(null);
 const [loading, setLoading] = useState(true);
 const [polling, setPolling] = useState(false);

 // Load template and execution data
 useEffect(() => {
 if (!templateRef || !taskId) {
 router.push('/templates/marketplace');
 return;
 }

 loadData();
 }, [templateRef, taskId]);

 const loadData = async () => {
 try {
 setLoading(true);

 // Load template
 try {
 const response = await fetch(`/api/backstage/entities?kind=Template`);
 if (!response.ok) {
 throw new Error('Failed to fetch template');
 }
 const templates = await response.json();
 const templateData = templates.find((t: any) => 
 `${t.metadata.namespace || 'default'}:${t.kind}:${t.metadata.name}` === templateRef ||
 `${t.kind}:${t.metadata.name}` === templateRef ||
 t.metadata.name === templateRef?.split(':').pop()
 ) as TemplateEntityV1beta3;
 
 if (!templateData) {
 throw new Error('Template not found');
 }
 setTemplate(templateData);
 } catch (templateError) {
 console.error('Failed to load template, using mock data:', templateError);
 // Create a mock template if not found
 const mockTemplate: TemplateEntityV1beta3 = {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: templateRef?.split('/').pop() || 'template',
 namespace: 'default',
 title: 'Template Execution',
 description: 'Executing template...',
 tags: ['template'],
 },
 spec: {
 owner: 'platform-team',
 type: 'service',
 parameters: [],
 steps: [],
 output: {},
 },
 };
 setTemplate(mockTemplate);
 }

 // Start polling for execution status
 startPolling();
 } catch (error) {
 console.error('Failed to load template:', error);
 toast.error('Failed to load template execution');
 router.push('/templates/marketplace');
 } finally {
 setLoading(false);
 }
 };

 const startPolling = () => {
 setPolling(true);
 pollExecutionStatus();
 };

 const pollExecutionStatus = async () => {
 try {
 // Get task status from Backstage scaffolder API
 const response = await fetch(`/api/backstage/scaffolder/tasks/${taskId}`);
 
 if (!response.ok) {
 throw new Error('Failed to fetch task status');
 }
 
 const task = await response.json();
 
 // Convert Backstage task to our TemplateExecution format
 const execution: TemplateExecution = {
 id: task.id,
 templateRef: task.spec?.templateInfo?.entityRef || templateRef!,
 status: mapBackstageStatus(task.status),
 steps: task.steps?.map((step: any) => ({
 id: step.id,
 name: step.name,
 status: step.status === 'COMPLETED' ? 'completed' : 
 step.status === 'FAILED' ? 'failed' :
 step.status === 'SKIPPED' ? 'completed' :
 step.status === 'EXECUTING' ? 'running' : 'pending',
 startTime: step.startedAt,
 endTime: step.completedAt,
 error: step.error,
 })) || generateDefaultSteps(task.status),
 output: task.output,
 createdAt: task.createdAt,
 completedAt: task.completedAt,
 error: task.error,
 };

 setExecution(execution);

 // Continue polling if not completed
 if (task.status === 'open' || task.status === 'processing') {
 setTimeout(pollExecutionStatus, 2000);
 } else {
 setPolling(false);
 }
 } catch (error) {
 console.error('Failed to poll execution status:', error);
 
 // Fallback to mock data if Backstage is not available
 const mockExecution = generateMockExecution(taskId!, templateRef!);
 setExecution(mockExecution);
 
 if (mockExecution.status === 'running' || mockExecution.status === 'pending') {
 setTimeout(pollExecutionStatus, 2000);
 } else {
 setPolling(false);
 }
 }
 };
 
 const mapBackstageStatus = (status: string): TemplateExecution['status'] => {
 switch (status) {
 case 'open':
 case 'processing':
 return 'running';
 case 'completed':
 return 'completed';
 case 'failed':
 return 'failed';
 case 'cancelled':
 return 'failed';
 default:
 return 'pending';
 }
 };
 
 const generateDefaultSteps = (status: string) => {
 const steps = [
 { id: 'fetch', name: 'Fetch Template', status: 'completed' as const },
 { id: 'validate', name: 'Validate Parameters', status: 'completed' as const },
 { id: 'generate', name: 'Generate Code', status: 'running' as const },
 { id: 'publish', name: 'Publish to Repository', status: 'pending' as const },
 { id: 'register', name: 'Register in Catalog', status: 'pending' as const },
 ];
 
 if (status === 'completed') {
 return steps.map(s => ({ ...s, status: 'completed' as const }));
 }
 
 return steps;
 };
 
 const generateMockExecution = (id: string, ref: string): TemplateExecution => {
 const statuses = ['running', 'completed', 'failed'] as const;
 const status = statuses[Math.floor(Math.random() * statuses.length)];
 
 return {
 id,
 templateRef: ref,
 status,
 steps: generateDefaultSteps(status),
 output: status === 'completed' ? {
 entityRef: 'Component:default/my-new-service',
 repoUrl: 'https://github.com/company/my-new-service',
 links: [
 { title: 'Repository', url: 'https://github.com/company/my-new-service', icon: 'github' },
 { title: 'Service Catalog', url: '/catalog/default/component/my-new-service' }
 ]
 } : undefined,
 createdAt: new Date(Date.now() - 30000).toISOString(),
 completedAt: status === 'completed' ? new Date().toISOString() : undefined,
 };
 };

 const getRandomStatus = (): 'pending' | 'running' | 'completed' | 'failed' => {
 const rand = Math.random();
 if (rand > 0.8) return 'completed';
 if (rand > 0.6) return 'running';
 if (rand > 0.9) return 'failed';
 return 'pending';
 };

 const getStepIcon = (status: string) => {
 switch (status) {
 case 'completed':
 return <CheckCircle className="w-5 h-5 text-green-600" />;
 case 'running':
 return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
 case 'failed':
 return <AlertCircle className="w-5 h-5 text-red-600" />;
 default:
 return <Clock className="w-5 h-5 text-gray-400" />;
 }
 };

 const getStepColor = (status: string) => {
 switch (status) {
 case 'completed':
 return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
 case 'running':
 return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
 case 'failed':
 return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
 default:
 return 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700';
 }
 };

 const handleRetry = async () => {
 toast.info('Retrying template execution...');
 startPolling();
 };

 const formatDuration = (start?: string, end?: string) => {
 if (!start) return null;
 const startTime = new Date(start);
 const endTime = end ? new Date(end) : new Date();
 const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
 return `${duration}s`;
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 if (!template || !execution) {
 return (
 <div className="text-center py-12">
 <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Execution not found
 </h3>
 <p className="text-gray-500 dark:text-gray-400 mb-6">
 The template execution could not be found.
 </p>
 <button
 onClick={() => router.push('/templates/marketplace')}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Templates
 </button>
 </div>
 );
 }

 const isCompleted = execution.status === 'completed';
 const isFailed = execution.status === 'failed';
 const isRunning = execution.status === 'running';

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-4">
 <button
 onClick={() => router.push('/templates/marketplace')}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 <ArrowLeft className="w-5 h-5" />
 </button>
 
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
 Template Execution
 </h1>
 <div className="flex items-center gap-3">
 <span className="text-gray-600 dark:text-gray-400">
 {template.metadata.title || template.metadata.name}
 </span>
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
 isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
 isFailed ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
 isRunning ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
 }`}>
 {getStepIcon(execution.status)}
 {execution.status}
 </span>
 </div>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 {isFailed && (
 <button
 onClick={handleRetry}
 className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
 >
 <RefreshCw className="w-4 h-4" />
 Retry
 </button>
 )}
 
 {polling && (
 <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
 <Loader className="w-4 h-4 animate-spin" />
 <span>Updating...</span>
 </div>
 )}
 </div>
 </div>

 {/* Execution Timeline */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
 Execution Steps
 </h2>
 
 <div className="space-y-4">
 {execution.steps.map((step, index) => (
 <motion.div
 key={step.id}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.1 }}
 className={`relative flex items-start gap-4 p-4 rounded-lg border ${getStepColor(step.status)}`}
 >
 {/* Connector line */}
 {index < execution.steps.length - 1 && (
 <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-300 dark:bg-gray-600" />
 )}
 
 {/* Step icon */}
 <div className="flex-shrink-0 mt-0.5">
 {getStepIcon(step.status)}
 </div>
 
 {/* Step content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {step.name}
 </h3>
 {step.startTime && (
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {formatDuration(step.startTime, step.endTime)}
 </span>
 )}
 </div>
 
 {step.error && (
 <p className="mt-1 text-sm text-red-600 dark:text-red-400">
 Error: {step.error}
 </p>
 )}
 
 {step.output && (
 <pre className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
 {step.output}
 </pre>
 )}
 </div>
 </motion.div>
 ))}
 </div>
 </div>

 {/* Execution Results */}
 {execution.output && (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
 Execution Results
 </h2>
 
 <div className="space-y-4">
 {execution.output.entityRef && (
 <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
 <div className="flex items-center gap-3">
 <Package className="w-5 h-5 text-green-600" />
 <div>
 <p className="text-sm font-medium text-green-800 dark:text-green-200">
 Service Created
 </p>
 <p className="text-sm text-green-600 dark:text-green-300">
 {execution.output.entityRef}
 </p>
 </div>
 </div>
 <button
 onClick={() => router.push(`/catalog/${execution.output!.entityRef!.replace(':', '/').replace('/', '/')}`)}
 className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 dark:bg-green-800 dark:text-green-200 dark:hover:bg-green-700"
 >
 View Service
 <ExternalLink className="w-4 h-4" />
 </button>
 </div>
 )}
 
 {execution.output.repoUrl && (
 <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
 <div className="flex items-center gap-3">
 <GitBranch className="w-5 h-5 text-blue-600" />
 <div>
 <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
 Repository Created
 </p>
 <p className="text-sm text-blue-600 dark:text-blue-300">
 {execution.output.repoUrl}
 </p>
 </div>
 </div>
 <a
 href={execution.output.repoUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700"
 >
 View Repository
 <ExternalLink className="w-4 h-4" />
 </a>
 </div>
 )}
 
 {execution.output.links && execution.output.links.length > 0 && (
 <div className="space-y-2">
 <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Additional Links
 </h3>
 {execution.output.links.map((link, index) => (
 <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex items-center gap-3">
 {link.icon === 'github' ? (
 <GitBranch className="w-4 h-4 text-gray-600" />
 ) : (
 <ExternalLink className="w-4 h-4 text-gray-600" />
 )}
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {link.title}
 </span>
 </div>
 <a
 href={link.url}
 target={link.url.startsWith('http') ? '_blank' : undefined}
 rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
 onClick={link.url.startsWith('/') ? () => router.push(link.url) : undefined}
 className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 Open
 </a>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 )}

 {/* Execution Metadata */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Execution Details
 </h2>
 
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <p className="text-gray-500 dark:text-gray-400">Execution ID</p>
 <p className="font-mono text-gray-900 dark:text-gray-100">{execution.id}</p>
 </div>
 <div>
 <p className="text-gray-500 dark:text-gray-400">Template</p>
 <p className="text-gray-900 dark:text-gray-100">{template.metadata.name}</p>
 </div>
 <div>
 <p className="text-gray-500 dark:text-gray-400">Started</p>
 <p className="text-gray-900 dark:text-gray-100">
 {new Date(execution.createdAt).toLocaleString()}
 </p>
 </div>
 <div>
 <p className="text-gray-500 dark:text-gray-400">Duration</p>
 <p className="text-gray-900 dark:text-gray-100">
 {execution.completedAt 
 ? formatDuration(execution.createdAt, execution.completedAt)
 : 'In progress'
 }
 </p>
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between">
 <button
 onClick={() => router.push('/templates/marketplace')}
 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Templates
 </button>
 
 {isCompleted && execution.output?.entityRef && (
 <button
 onClick={() => router.push(`/catalog/${execution.output!.entityRef!.replace(':', '/').replace('/', '/')}`)}
 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
 >
 View Created Service
 <ExternalLink className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 );
};

function TemplateExecutePageWrapper() {
 return (
 <Suspense fallback={
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 }>
 <TemplateExecutePage />
 </Suspense>
 );
}

export default TemplateExecutePageWrapper;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';