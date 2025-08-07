'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-hooks/exhaustive-deps */

// Removed date-fns import - using native JavaScript date formatting instead

// Helper function to replace formatDistanceToNow
const getRelativeTimeString = (date: Date): string => {
 const now = new Date();
 const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

 if (diffInSeconds < 60) {
 return diffInSeconds <= 1 ? 'just now' : `${diffInSeconds} seconds ago`;
 }

 const diffInMinutes = Math.floor(diffInSeconds / 60);
 if (diffInMinutes < 60) {
 return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
 }

 const diffInHours = Math.floor(diffInMinutes / 60);
 if (diffInHours < 24) {
 return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
 }

 const diffInDays = Math.floor(diffInHours / 24);
 if (diffInDays < 7) {
 return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
 }

 const diffInWeeks = Math.floor(diffInDays / 7);
 if (diffInWeeks < 4) {
 return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
 }

 const diffInMonths = Math.floor(diffInDays / 30);
 if (diffInMonths < 12) {
 return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
 }

 const diffInYears = Math.floor(diffInDays / 365);
 return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
};
import { motion, AnimatePresence } from 'framer-motion';
import {
 Play,
 Pause,
 Square,
 CheckCircle,
 XCircle,
 Clock,
 AlertTriangle,
 GitBranch,
 Package,
 Rocket,
 Shield,
 Database,
 Monitor,
 Users,
 FileText,
 ArrowRight,
 MoreHorizontal,
 RefreshCw,
 Calendar,
 Filter,
 ExternalLink,
 Eye,
 Download
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface PipelineStage {
 id: string;
 name: string;
 type: 'build' | 'test' | 'security' | 'deploy' | 'monitor' | 'approval';
 status: 'pending' | 'running' | 'success' | 'failure' | 'skipped' | 'waiting';
 duration?: number;
 startTime?: string;
 endTime?: string;
 logs?: string[];
 artifacts?: string[];
 approvers?: string[];
 environment?: string;
 dependencies?: string[];
}

interface DeploymentPipeline {
 id: string;
 name: string;
 serviceRef: string;
 branch: string;
 commit: {
 hash: string;
 message: string;
 author: string;
 timestamp: string;
 };
 trigger: 'manual' | 'push' | 'schedule' | 'api';
 status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
 stages: PipelineStage[];
 startTime: string;
 endTime?: string;
 duration?: number;
 environment: 'development' | 'staging' | 'production';
 version?: string;
 rollbackEnabled?: boolean;
}

interface DeploymentPipelineProps {
 serviceRef?: string;
 pipelineId?: string;
 showHistory?: boolean;
 compact?: boolean;
}

export const DeploymentPipeline = ({
 serviceRef,
 pipelineId,
 showHistory = true,
 compact = false
}: DeploymentPipelineProps) => {
 const [pipelines, setPipelines] = useState<DeploymentPipeline[]>([]);
 const [selectedPipeline, setSelectedPipeline] = useState<DeploymentPipeline | null>(null);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<string>('all');
 const [autoRefresh, setAutoRefresh] = useState(true);

 useEffect(() => {
 loadPipelines();
 
 if (autoRefresh) {
 const interval = setInterval(loadPipelines, 5000);
 return () => clearInterval(interval);
 }
 }, [serviceRef, pipelineId, autoRefresh]);

 const loadPipelines = async () => {
 try {
 setLoading(true);
 
 // Generate mock pipeline data
 const mockPipelines = generateMockPipelines(serviceRef);
 setPipelines(mockPipelines);
 
 if (pipelineId) {
 const pipeline = mockPipelines.find(p => p.id === pipelineId);
 setSelectedPipeline(pipeline || null);
 } else if (!selectedPipeline && mockPipelines.length > 0) {
 setSelectedPipeline(mockPipelines[0]);
 }
 } catch (error) {
 console.error('Failed to load pipelines:', error);
 toast.error('Failed to load deployment pipelines');
 } finally {
 setLoading(false);
 }
 };

 const generateMockPipelines = (service?: string): DeploymentPipeline[] => {
 const services = service ? [service] : [
 'user-service',
 'order-service',
 'payment-service',
 'notification-service'
 ];

 const pipelines: DeploymentPipeline[] = [];
 
 services.forEach((serviceName, serviceIndex) => {
 // Generate 3-5 recent pipelines per service
 const pipelineCount = 3 + Math.floor(Math.random() * 3);
 
 for (let i = 0; i < pipelineCount; i++) {
 const isRecent = i < 2;
 const isRunning = i === 0 && Math.random() < 0.3;
 const isFailed = !isRunning && Math.random() < 0.2;
 
 const startTime = new Date(Date.now() - (i * 2 + Math.random() * 4) * 60 * 60 * 1000);
 const duration = isRunning ? undefined : 300 + Math.random() * 1200; // 5-25 minutes
 const endTime = duration ? new Date(startTime.getTime() + duration * 1000) : undefined;
 
 const stages: PipelineStage[] = [
 {
 id: 'build',
 name: 'Build',
 type: 'build',
 status: isRunning && i === 0 ? 'running' : isFailed && Math.random() < 0.3 ? 'failure' : 'success',
 duration: isRunning ? undefined : 60 + Math.random() * 120,
 startTime: startTime.toISOString(),
 endTime: isRunning ? undefined : new Date(startTime.getTime() + (60 + Math.random() * 120) * 1000).toISOString(),
 artifacts: ['app.jar', 'Dockerfile']
 },
 {
 id: 'test',
 name: 'Unit Tests',
 type: 'test',
 status: isRunning && i === 0 ? (Math.random() < 0.5 ? 'running' : 'pending') : isFailed && Math.random() < 0.4 ? 'failure' : 'success',
 duration: isRunning ? undefined : 120 + Math.random() * 180,
 artifacts: ['test-results.xml', 'coverage-report.html']
 },
 {
 id: 'security',
 name: 'Security Scan',
 type: 'security',
 status: isRunning && i === 0 ? 'pending' : isFailed && Math.random() < 0.2 ? 'failure' : 'success',
 duration: isRunning ? undefined : 90 + Math.random() * 90,
 artifacts: ['security-report.json']
 },
 {
 id: 'deploy-staging',
 name: 'Deploy to Staging',
 type: 'deploy',
 status: isRunning && i === 0 ? 'pending' : isFailed ? 'skipped' : 'success',
 duration: isRunning ? undefined : 30 + Math.random() * 60,
 environment: 'staging'
 },
 {
 id: 'integration-tests',
 name: 'Integration Tests',
 type: 'test',
 status: isRunning && i === 0 ? 'pending' : isFailed ? 'skipped' : 'success',
 duration: isRunning ? undefined : 180 + Math.random() * 300,
 environment: 'staging'
 }
 ];

 // Add production deployment for successful pipelines
 if (!isFailed && (!isRunning || Math.random() < 0.3)) {
 stages.push(
 {
 id: 'approval',
 name: 'Production Approval',
 type: 'approval',
 status: isRunning ? 'waiting' : 'success',
 approvers: ['ops-team', 'tech-lead'],
 environment: 'production'
 },
 {
 id: 'deploy-prod',
 name: 'Deploy to Production',
 type: 'deploy',
 status: isRunning ? 'pending' : 'success',
 duration: isRunning ? undefined : 45 + Math.random() * 90,
 environment: 'production'
 },
 {
 id: 'monitor',
 name: 'Health Check',
 type: 'monitor',
 status: isRunning ? 'pending' : 'success',
 duration: isRunning ? undefined : 30 + Math.random() * 60,
 environment: 'production'
 }
 );
 }

 pipelines.push({
 id: `pipeline-${serviceName}-${i}`,
 name: `${serviceName} Deploy Pipeline`,
 serviceRef: `component:default/${serviceName}`,
 branch: i === 0 ? 'main' : Math.random() < 0.8 ? 'main' : 'develop',
 commit: {
 hash: Math.random().toString(36).substring(2, 9),
 message: i === 0 ? 'feat: add new user authentication flow' : 
 i === 1 ? 'fix: resolve payment processing timeout' :
 i === 2 ? 'docs: update API documentation' :
 'refactor: optimize database queries',
 author: ['alice@company.com', 'bob@company.com', 'charlie@company.com'][Math.floor(Math.random() * 3)],
 timestamp: new Date(startTime.getTime() - 60000).toISOString()
 },
 trigger: i === 0 ? 'push' : ['push', 'manual', 'schedule'][Math.floor(Math.random() * 3)] as any,
 status: isRunning ? 'running' : isFailed ? 'failure' : 'success',
 stages,
 startTime: startTime.toISOString(),
 endTime: endTime?.toISOString(),
 duration,
 environment: stages.some(s => s.environment === 'production') ? 'production' : 'staging',
 version: `v1.${serviceIndex}.${pipelineCount - i}`,
 rollbackEnabled: !isRunning && !isFailed && i < 2
 });
 }
 });

 return pipelines.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
 };

 const getStageIcon = (stage: PipelineStage) => {
 switch (stage.type) {
 case 'build': return <Package className="w-4 h-4" />;
 case 'test': return <Shield className="w-4 h-4" />;
 case 'security': return <Shield className="w-4 h-4" />;
 case 'deploy': return <Rocket className="w-4 h-4" />;
 case 'monitor': return <Monitor className="w-4 h-4" />;
 case 'approval': return <Users className="w-4 h-4" />;
 default: return <CheckCircle className="w-4 h-4" />;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'success': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
 case 'failure': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
 case 'running': return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
 case 'waiting': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
 case 'pending': return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 case 'skipped': return 'text-gray-400 bg-gray-50 dark:bg-gray-800 dark:text-gray-500';
 default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'success': return <CheckCircle className="w-4 h-4" />;
 case 'failure': return <XCircle className="w-4 h-4" />;
 case 'running': return <Play className="w-4 h-4" />;
 case 'waiting': return <Clock className="w-4 h-4" />;
 case 'pending': return <Clock className="w-4 h-4" />;
 case 'skipped': return <Square className="w-4 h-4" />;
 default: return <Clock className="w-4 h-4" />;
 }
 };

 const filteredPipelines = pipelines.filter(pipeline => {
 if (filter === 'all') return true;
 if (filter === 'running') return pipeline.status === 'running';
 if (filter === 'failed') return pipeline.status === 'failure';
 if (filter === 'success') return pipeline.status === 'success';
 return true;
 });

 const handlePipelineAction = (action: 'retry' | 'cancel' | 'approve', pipelineId: string, stageId?: string) => {
 toast.success(`${action} action triggered for pipeline ${pipelineId}`);
 // In real implementation, this would call the appropriate API
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 if (compact) {
 return (
 <div className="space-y-4">
 {/* Compact Pipeline Status */}
 {selectedPipeline && (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Latest Deployment
 </h3>
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPipeline.status)}`}>
 {getStatusIcon(selectedPipeline.status)}
 {selectedPipeline.status}
 </span>
 </div>
 <button
 onClick={() => window.open(`/deployment/${selectedPipeline.id}`, '_blank')}
 className="text-blue-600 hover:text-blue-700 text-sm"
 >
 View Details
 </button>
 </div>

 <div className="flex flex-wrap gap-2 mb-4">
 {selectedPipeline.stages.map((stage, index) => (
 <div key={stage.id} className="flex items-center gap-1">
 <div className={`p-2 rounded-md ${getStatusColor(stage.status)}`}>
 {getStageIcon(stage)}
 </div>
 {index < selectedPipeline.stages.length - 1 && (
 <ArrowRight className="w-3 h-3 text-gray-400" />
 )}
 </div>
 ))}
 </div>

 <div className="text-sm text-gray-600 dark:text-gray-400">
 <p>Branch: {selectedPipeline.branch} • Version: {selectedPipeline.version}</p>
 <p>Started {getRelativeTimeString(new Date(selectedPipeline.startTime))}</p>
 </div>
 </div>
 )}
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Deployment Pipelines
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Monitor and manage your deployment pipelines across all services
 </p>
 </div>

 <div className="flex items-center gap-3">
 <select
 value={filter}
 onChange={(e) => setFilter(e.target.value)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Pipelines</option>
 <option value="running">Running</option>
 <option value="failed">Failed</option>
 <option value="success">Successful</option>
 </select>

 <button
 onClick={() => setAutoRefresh(!autoRefresh)}
 className={`p-2 rounded-md ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
 title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
 >
 <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Pipeline List */}
 <div className="lg:col-span-1">
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Recent Pipelines
 </h3>
 </div>
 <div className="max-h-96 overflow-y-auto">
 {filteredPipelines.map(pipeline => (
 <div
 key={pipeline.id}
 onClick={() => setSelectedPipeline(pipeline)}
 className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
 selectedPipeline?.id === pipeline.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
 }`}
 >
 <div className="flex items-center justify-between mb-2">
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {pipeline.serviceRef.split('/').pop()}
 </span>
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pipeline.status)}`}>
 {getStatusIcon(pipeline.status)}
 {pipeline.status}
 </span>
 </div>
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
 {pipeline.commit.message.substring(0, 50)}...
 </p>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 {getRelativeTimeString(new Date(pipeline.startTime))}
 </p>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Pipeline Details */}
 <div className="lg:col-span-2">
 {selectedPipeline ? (
 <div className="space-y-6">
 {/* Pipeline Header */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-start justify-between mb-4">
 <div>
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 {selectedPipeline.name}
 </h2>
 <p className="text-gray-600 dark:text-gray-400 mt-1">
 {selectedPipeline.commit.message}
 </p>
 </div>
 <div className="flex items-center gap-2">
 {selectedPipeline.status === 'running' && (
 <button
 onClick={() => handlePipelineAction('cancel', selectedPipeline.id)}
 className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50"
 >
 Cancel
 </button>
 )}
 {selectedPipeline.status === 'failure' && (
 <button
 onClick={() => handlePipelineAction('retry', selectedPipeline.id)}
 className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 Retry
 </button>
 )}
 <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedPipeline.status)}`}>
 {getStatusIcon(selectedPipeline.status)}
 {selectedPipeline.status}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
 <div>
 <p className="text-gray-500 dark:text-gray-400">Branch</p>
 <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
 <GitBranch className="w-3 h-3" />
 {selectedPipeline.branch}
 </p>
 </div>
 <div>
 <p className="text-gray-500 dark:text-gray-400">Commit</p>
 <p className="font-medium text-gray-900 dark:text-gray-100 font-mono">
 {selectedPipeline.commit.hash}
 </p>
 </div>
 <div>
 <p className="text-gray-500 dark:text-gray-400">Environment</p>
 <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
 {selectedPipeline.environment}
 </p>
 </div>
 <div>
 <p className="text-gray-500 dark:text-gray-400">Duration</p>
 <p className="font-medium text-gray-900 dark:text-gray-100">
 {selectedPipeline.duration ? `${Math.floor(selectedPipeline.duration / 60)}m ${selectedPipeline.duration % 60}s` : 'Running...'}
 </p>
 </div>
 </div>
 </div>

 {/* Pipeline Stages */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Pipeline Stages
 </h3>
 
 <div className="space-y-4">
 {selectedPipeline.stages.map((stage, index) => (
 <motion.div
 key={stage.id}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.1 }}
 className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
 >
 <div className={`p-3 rounded-lg ${getStatusColor(stage.status)}`}>
 {getStageIcon(stage)}
 </div>
 
 <div className="flex-1">
 <div className="flex items-center justify-between mb-1">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 {stage.name}
 </h4>
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(stage.status)}`}>
 {getStatusIcon(stage.status)}
 {stage.status}
 </span>
 </div>
 
 <div className="text-sm text-gray-600 dark:text-gray-400">
 {stage.duration && (
 <span>Duration: {Math.floor(stage.duration / 60)}m {Math.floor(stage.duration % 60)}s</span>
 )}
 {stage.environment && (
 <span className="ml-4">Environment: {stage.environment}</span>
 )}
 </div>

 {stage.type === 'approval' && stage.status === 'waiting' && (
 <div className="mt-2">
 <button
 onClick={() => handlePipelineAction('approve', selectedPipeline.id, stage.id)}
 className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
 >
 Approve
 </button>
 </div>
 )}
 </div>

 {stage.status === 'running' && (
 <div className="w-4 h-4">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
 </div>
 )}

 {index < selectedPipeline.stages.length - 1 && (
 <div className="absolute left-8 mt-16 w-0.5 h-8 bg-gray-200 dark:bg-gray-700"></div>
 )}
 </motion.div>
 ))}
 </div>
 </div>
 </div>
 ) : (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
 <Rocket className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Select a Pipeline
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Choose a pipeline from the list to view its details and stages.
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}