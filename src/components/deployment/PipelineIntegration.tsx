'use client';

import { useState, useEffect } from 'react';
import { 
 Play, 
 Pause, 
 Square, 
 CheckCircle, 
 XCircle, 
 Clock, 
 AlertTriangle,
 GitBranch,
 Code,
 Package,
 Server,
 Zap,
 RefreshCw,
 ExternalLink,
 Settings,
 Eye,
 Download,
 FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

import { backstageService } from '@/lib/backstage/service';
import { LoadingSpinner, DataLoadingState, ProgressiveLoader } from '@/components/ui/LoadingStates';
import { useError } from '@/contexts/ErrorContext';

interface PipelineStage {
 id: string;
 name: string;
 status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
 startTime?: string;
 endTime?: string;
 duration?: number;
 logs?: string[];
 artifacts?: string[];
 environment?: string;
}

interface Pipeline {
 id: string;
 name: string;
 branch: string;
 commit: {
 hash: string;
 author: string;
 message: string;
 timestamp: string;
 };
 status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
 stages: PipelineStage[];
 startTime: string;
 endTime?: string;
 duration?: number;
 triggeredBy: string;
 environment: string;
}

interface PipelineConfig {
 provider: 'github-actions' | 'jenkins' | 'gitlab-ci' | 'azure-devops';
 repository: string;
 defaultBranch: string;
 environments: string[];
 webhookUrl?: string;
 apiKey?: string;
}

export function PipelineIntegration({ 
 serviceRef, 
 compact = false 
}: { 
 serviceRef: string; 
 compact?: boolean;
}) {
 const [pipelines, setPipelines] = useState<Pipeline[]>([]);
 const [config, setConfig] = useState<PipelineConfig | null>(null);
 const [loading, setLoading] = useState(true);
 const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
 const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
 const { handleApiError } = useError();

 useEffect(() => {
 loadPipelineData();
 
 // Poll for updates every 30 seconds
 const interval = setInterval(() => {
 if (activePipeline) {
 loadPipelineData();
 }
 }, 30000);

 return () => clearInterval(interval);
 }, [serviceRef]);

 const loadPipelineData = async () => {
 try {
 setLoading(true);
 
 // Load configuration and recent pipelines
 const mockConfig: PipelineConfig = {
 provider: 'github-actions',
 repository: `company/${serviceRef.split('/').pop()}`,
 defaultBranch: 'main',
 environments: ['development', 'staging', 'production'],
 webhookUrl: `https://api.github.com/repos/company/${serviceRef.split('/').pop()}/hooks`
 };
 setConfig(mockConfig);

 // Generate mock pipeline data
 const mockPipelines: Pipeline[] = Array.from({ length: 5 }, (_, i) => {
 const status = i === 0 ? 'running' : ['success', 'failed', 'success'][Math.floor(Math.random() * 3)] as Pipeline['status'];
 const startTime = new Date(Date.now() - i * 60 * 60 * 1000).toISOString();
 
 return {
 id: `pipeline-${i + 1}`,
 name: `Deploy to ${['Production', 'Staging', 'Development'][i % 3]}`,
 branch: i === 0 ? 'main' : ['main', 'develop', 'feature/auth'][Math.floor(Math.random() * 3)],
 commit: {
 hash: Math.random().toString(36).substr(2, 8),
 author: ['john.doe', 'jane.smith', 'bob.wilson'][Math.floor(Math.random() * 3)],
 message: ['Fix authentication bug', 'Add new feature', 'Update dependencies'][Math.floor(Math.random() * 3)],
 timestamp: startTime
 },
 status,
 stages: generateMockStages(status),
 startTime,
 endTime: status !== 'running' ? new Date(Date.parse(startTime) + Math.random() * 30 * 60 * 1000).toISOString() : undefined,
 duration: status !== 'running' ? Math.floor(Math.random() * 1800 + 300) : undefined,
 triggeredBy: 'push',
 environment: ['production', 'staging', 'development'][i % 3]
 };
 });

 setPipelines(mockPipelines);
 setActivePipeline(mockPipelines.find(p => p.status === 'running') || null);
 
 } catch (error) {
 handleApiError(error, 'Loading pipeline data');
 } finally {
 setLoading(false);
 }
 };

 const generateMockStages = (pipelineStatus: Pipeline['status']): PipelineStage[] => {
 const stages = [
 { id: 'checkout', name: 'Checkout Code', environment: undefined },
 { id: 'build', name: 'Build Application', environment: undefined },
 { id: 'test', name: 'Run Tests', environment: undefined },
 { id: 'security', name: 'Security Scan', environment: undefined },
 { id: 'package', name: 'Package Artifacts', environment: undefined },
 { id: 'deploy', name: 'Deploy to Environment', environment: 'production' }
 ];

 return stages.map((stage, index) => {
 let status: PipelineStage['status'] = 'pending';
 
 if (pipelineStatus === 'running') {
 if (index < 3) status = 'success';
 else if (index === 3) status = 'running';
 else status = 'pending';
 } else if (pipelineStatus === 'success') {
 status = 'success';
 } else if (pipelineStatus === 'failed') {
 if (index < 4) status = index === 3 ? 'failed' : 'success';
 else status = 'skipped';
 }

 return {
 id: stage.id,
 name: stage.name,
 status,
 startTime: status !== 'pending' ? new Date(Date.now() - (6 - index) * 5 * 60 * 1000).toISOString() : undefined,
 endTime: status === 'success' || status === 'failed' ? new Date(Date.now() - (6 - index - 1) * 5 * 60 * 1000).toISOString() : undefined,
 duration: status === 'success' || status === 'failed' ? Math.floor(Math.random() * 300 + 60) : undefined,
 environment: stage.environment,
 logs: status !== 'pending' ? [
 `[${new Date().toISOString()}] Starting ${stage.name}...`,
 `[${new Date().toISOString()}] Processing...`,
 status === 'failed' ? `[${new Date().toISOString()}] Error: Process failed` : 
 `[${new Date().toISOString()}] ${stage.name} completed successfully`
 ] : [],
 artifacts: status === 'success' && stage.id === 'package' ? [
 'app-v1.2.3.tar.gz',
 'docker-image:latest'
 ] : []
 };
 });
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
 case 'running': return <Clock className="w-4 h-4 text-blue-600 animate-pulse" />;
 case 'pending': return <Clock className="w-4 h-4 text-gray-400" />;
 case 'skipped': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
 default: return <Clock className="w-4 h-4 text-gray-400" />;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'success': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800';
 case 'failed': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800';
 case 'running': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800';
 case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
 case 'cancelled': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-800';
 default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
 }
 };

 const triggerPipeline = async (environment: string, branch: string = 'main') => {
 try {
 toast.info(`Triggering deployment to ${environment}...`);
 
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 const newPipeline: Pipeline = {
 id: `pipeline-${Date.now()}`,
 name: `Deploy to ${environment}`,
 branch,
 commit: {
 hash: Math.random().toString(36).substr(2, 8),
 author: 'current-user',
 message: 'Manual deployment trigger',
 timestamp: new Date().toISOString()
 },
 status: 'running',
 stages: generateMockStages('running'),
 startTime: new Date().toISOString(),
 triggeredBy: 'manual',
 environment
 };

 setPipelines(prev => [newPipeline, ...prev]);
 setActivePipeline(newPipeline);
 toast.success(`Deployment to ${environment} started!`);
 
 } catch (error) {
 handleApiError(error, 'Triggering pipeline');
 }
 };

 const formatDuration = (seconds: number) => {
 const minutes = Math.floor(seconds / 60);
 const remainingSeconds = seconds % 60;
 return `${minutes}m ${remainingSeconds}s`;
 };

 if (compact) {
 return (
 <DataLoadingState loading={loading} data={pipelines}>
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold text-gray-900 dark:text-gray-100">
 Deployment Status
 </h3>
 <button
 onClick={() => loadPipelineData()}
 className="p-1 text-gray-400 hover:text-gray-600 rounded"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 </div>
 
 {activePipeline ? (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">{activePipeline.name}</span>
 <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(activePipeline.status)}`}>
 {activePipeline.status}
 </span>
 </div>
 
 <div className="space-y-2">
 {activePipeline.stages.map((stage, index) => (
 <div key={stage.id} className="flex items-center gap-2">
 {getStatusIcon(stage.status)}
 <span className="text-sm text-gray-600 dark:text-gray-300">
 {stage.name}
 </span>
 {stage.duration && (
 <span className="text-xs text-gray-500">
 {formatDuration(stage.duration)}
 </span>
 )}
 </div>
 ))}
 </div>
 </div>
 ) : (
 <p className="text-gray-500 dark:text-gray-400 text-sm">
 No active deployments
 </p>
 )}
 </div>
 </DataLoadingState>
 );
 }

 return (
 <DataLoadingState loading={loading} data={pipelines}>
 <div className="space-y-6">
 {/* Pipeline Controls */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Deployment Pipeline
 </h2>
 <div className="flex items-center gap-2">
 <button
 onClick={() => loadPipelineData()}
 className="p-2 text-gray-400 hover:text-gray-600 rounded"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 <button className="p-2 text-gray-400 hover:text-gray-600 rounded">
 <Settings className="w-4 h-4" />
 </button>
 </div>
 </div>

 {config && (
 <div className="flex items-center gap-4 mb-6">
 <div className="flex items-center gap-2">
 <GitBranch className="w-4 h-4 text-gray-500" />
 <span className="text-sm text-gray-600 dark:text-gray-300">
 {config.repository}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <Code className="w-4 h-4 text-gray-500" />
 <span className="text-sm text-gray-600 dark:text-gray-300">
 {config.provider}
 </span>
 </div>
 </div>
 )}

 {/* Quick Deploy Actions */}
 <div className="flex gap-3">
 {config?.environments.map(env => (
 <button
 key={env}
 onClick={() => triggerPipeline(env)}
 className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
 env === 'production' 
 ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200'
 : env === 'staging'
 ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200'
 : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200'
 }`}
 >
 <div className="flex items-center gap-2">
 <Play className="w-4 h-4" />
 Deploy to {env}
 </div>
 </button>
 ))}
 </div>
 </div>

 {/* Active Pipeline */}
 {activePipeline && (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {activePipeline.name}
 </h3>
 <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
 <span>Branch: {activePipeline.branch}</span>
 <span>Commit: {activePipeline.commit.hash}</span>
 <span>By: {activePipeline.commit.author}</span>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(activePipeline.status)}`}>
 {activePipeline.status}
 </span>
 {activePipeline.status === 'running' && (
 <LoadingSpinner size="sm" />
 )}
 </div>
 </div>

 {/* Pipeline Stages */}
 <div className="space-y-4">
 {activePipeline.stages.map((stage, index) => (
 <motion.div
 key={stage.id}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.1 }}
 className={`relative flex items-start gap-4 p-4 rounded-lg border ${
 stage.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
 stage.status === 'failed' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
 stage.status === 'running' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
 }`}
 >
 {/* Connector line */}
 {index < activePipeline.stages.length - 1 && (
 <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-300 dark:bg-gray-600" />
 )}
 
 {/* Stage icon */}
 <div className="flex-shrink-0 mt-0.5">
 {getStatusIcon(stage.status)}
 </div>
 
 {/* Stage content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {stage.name}
 </h4>
 <div className="flex items-center gap-2">
 {stage.duration && (
 <span className="text-xs text-gray-500">
 {formatDuration(stage.duration)}
 </span>
 )}
 {stage.logs && stage.logs.length > 0 && (
 <button className="text-xs text-blue-600 hover:text-blue-700">
 <Eye className="w-3 h-3" />
 </button>
 )}
 </div>
 </div>
 
 {stage.environment && (
 <p className="text-xs text-gray-500 mt-1">
 Environment: {stage.environment}
 </p>
 )}
 
 {stage.artifacts && stage.artifacts.length > 0 && (
 <div className="flex items-center gap-2 mt-2">
 <Package className="w-3 h-3 text-gray-400" />
 <div className="flex gap-2">
 {stage.artifacts.map((artifact, i) => (
 <span key={i} className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
 {artifact}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 )}

 {/* Pipeline History */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Recent Deployments
 </h3>
 
 <div className="space-y-3">
 {pipelines.map((pipeline) => (
 <div
 key={pipeline.id}
 className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
 onClick={() => setSelectedPipeline(pipeline)}
 >
 <div>
 <div className="flex items-center gap-3">
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {pipeline.name}
 </span>
 <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(pipeline.status)}`}>
 {pipeline.status}
 </span>
 </div>
 <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
 <span>{pipeline.branch}</span>
 <span>{pipeline.commit.hash}</span>
 <span>{pipeline.commit.author}</span>
 {pipeline.duration && <span>{formatDuration(pipeline.duration)}</span>}
 </div>
 </div>
 
 <div className="text-sm text-gray-500">
 {new Date(pipeline.startTime).toLocaleString()}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </DataLoadingState>
 );
}