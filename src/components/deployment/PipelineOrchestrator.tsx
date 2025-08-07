'use client';

import { useState, useEffect } from 'react';
import { 
 Play, 
 Pause, 
 Square, 
 FastForward,
 RotateCcw,
 GitBranch,
 Settings,
 AlertTriangle,
 CheckCircle,
 Clock,
 Zap,
 Shield,
 Database,
 Globe,
 Monitor,
 Code,
 Package
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

import { DataLoadingState, ProgressiveLoader } from '@/components/ui/LoadingStates';
import { useError } from '@/contexts/ErrorContext';

interface DeploymentStrategy {
 id: string;
 name: string;
 description: string;
 type: 'blue-green' | 'rolling' | 'canary' | 'recreate';
 config: Record<string, any>;
 environments: string[];
 approvalRequired: boolean;
 automated: boolean;
}

interface DeploymentJob {
 id: string;
 strategyId: string;
 environment: string;
 status: 'pending' | 'running' | 'success' | 'failed' | 'paused' | 'cancelled';
 progress: number;
 currentStep: string;
 startTime?: string;
 endTime?: string;
 logs: string[];
 approvals?: {
 requiredBy: string[];
 approvedBy: string[];
 status: 'pending' | 'approved' | 'rejected';
 };
}

interface RollbackPlan {
 jobId: string;
 version: string;
 rollbackVersion: string;
 strategy: 'immediate' | 'graceful';
 estimatedTime: number;
 risks: string[];
}

export function PipelineOrchestrator({ 
 serviceRef 
}: { 
 serviceRef: string;
}) {
 const [strategies, setStrategies] = useState<DeploymentStrategy[]>([]);
 const [activeJobs, setActiveJobs] = useState<DeploymentJob[]>([]);
 const [selectedStrategy, setSelectedStrategy] = useState<DeploymentStrategy | null>(null);
 const [showConfigModal, setShowConfigModal] = useState(false);
 const [loading, setLoading] = useState(true);
 const { handleApiError } = useError();

 useEffect(() => {
 loadOrchestrationData();
 }, [serviceRef]);

 const loadOrchestrationData = async () => {
 try {
 setLoading(true);
 
 // Mock deployment strategies
 const mockStrategies: DeploymentStrategy[] = [
 {
 id: 'blue-green-prod',
 name: 'Blue-Green Production',
 description: 'Zero-downtime deployment with instant rollback capability',
 type: 'blue-green',
 config: {
 healthCheckPath: '/health',
 healthCheckTimeout: 300,
 trafficSwitchDelay: 60
 },
 environments: ['production'],
 approvalRequired: true,
 automated: false
 },
 {
 id: 'rolling-staging',
 name: 'Rolling Update Staging',
 description: 'Gradual deployment with controlled rollout',
 type: 'rolling',
 config: {
 maxUnavailable: '25%',
 maxSurge: '25%',
 progressDeadline: 600
 },
 environments: ['staging'],
 approvalRequired: false,
 automated: true
 },
 {
 id: 'canary-prod',
 name: 'Canary Production',
 description: 'Safe production deployment with traffic shifting',
 type: 'canary',
 config: {
 initialTraffic: 5,
 trafficIncrement: 10,
 stabilizationWindow: 300,
 successThreshold: 95
 },
 environments: ['production'],
 approvalRequired: true,
 automated: false
 }
 ];
 setStrategies(mockStrategies);

 // Mock active jobs
 const mockJobs: DeploymentJob[] = [
 {
 id: 'job-1',
 strategyId: 'canary-prod',
 environment: 'production',
 status: 'running',
 progress: 45,
 currentStep: 'Traffic shifting to 15%',
 startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
 logs: [
 '[10:30:15] Starting canary deployment...',
 '[10:30:45] Health checks passed',
 '[10:32:00] Shifting 5% traffic to canary',
 '[10:35:00] Monitoring metrics...',
 '[10:38:00] Shifting 10% traffic to canary',
 '[10:40:00] Current step: Shifting 15% traffic'
 ],
 approvals: {
 requiredBy: ['john.doe@company.com', 'jane.smith@company.com'],
 approvedBy: ['john.doe@company.com'],
 status: 'pending'
 }
 }
 ];
 setActiveJobs(mockJobs);

 } catch (error) {
 handleApiError(error, 'Loading orchestration data');
 } finally {
 setLoading(false);
 }
 };

 const executeDeployment = async (strategy: DeploymentStrategy, environment: string, version: string) => {
 try {
 toast.info(`Starting ${strategy.name} deployment...`);
 
 const newJob: DeploymentJob = {
 id: `job-${Date.now()}`,
 strategyId: strategy.id,
 environment,
 status: strategy.approvalRequired && environment === 'production' ? 'pending' : 'running',
 progress: 0,
 currentStep: strategy.approvalRequired ? 'Waiting for approval' : 'Initializing deployment',
 startTime: new Date().toISOString(),
 logs: [
 `[${new Date().toLocaleTimeString()}] Deployment initiated`,
 `[${new Date().toLocaleTimeString()}] Strategy: ${strategy.name}`,
 `[${new Date().toLocaleTimeString()}] Target version: ${version}`
 ],
 approvals: strategy.approvalRequired ? {
 requiredBy: ['john.doe@company.com', 'jane.smith@company.com'],
 approvedBy: [],
 status: 'pending'
 } : undefined
 };

 setActiveJobs(prev => [newJob, ...prev]);
 toast.success('Deployment job created!');

 } catch (error) {
 handleApiError(error, 'Executing deployment');
 }
 };

 const approveDeployment = async (jobId: string, approver: string) => {
 try {
 setActiveJobs(prev => prev.map(job => {
 if (job.id === jobId && job.approvals) {
 const updatedApprovals = {
 ...job.approvals,
 approvedBy: [...job.approvals.approvedBy, approver]
 };
 
 const allApproved = updatedApprovals.requiredBy.every(req => 
 updatedApprovals.approvedBy.includes(req)
 );

 return {
 ...job,
 approvals: {
 ...updatedApprovals,
 status: allApproved ? 'approved' as const : 'pending' as const
 },
 status: allApproved ? 'running' as const : job.status,
 currentStep: allApproved ? 'Deployment approved, starting...' : job.currentStep
 };
 }
 return job;
 }));

 toast.success('Deployment approved!');
 } catch (error) {
 handleApiError(error, 'Approving deployment');
 }
 };

 const pauseDeployment = async (jobId: string) => {
 try {
 setActiveJobs(prev => prev.map(job => 
 job.id === jobId ? { ...job, status: 'paused' as const, currentStep: 'Deployment paused' } : job
 ));
 toast.info('Deployment paused');
 } catch (error) {
 handleApiError(error, 'Pausing deployment');
 }
 };

 const resumeDeployment = async (jobId: string) => {
 try {
 setActiveJobs(prev => prev.map(job => 
 job.id === jobId ? { ...job, status: 'running' as const, currentStep: 'Deployment resumed' } : job
 ));
 toast.success('Deployment resumed');
 } catch (error) {
 handleApiError(error, 'Resuming deployment');
 }
 };

 const rollbackDeployment = async (jobId: string) => {
 try {
 const rollbackPlan: RollbackPlan = {
 jobId,
 version: 'v1.2.4',
 rollbackVersion: 'v1.2.3',
 strategy: 'immediate',
 estimatedTime: 300,
 risks: ['Potential data loss', 'Brief service interruption']
 };

 // In a real implementation, this would trigger the rollback process
 toast.success('Rollback initiated');
 } catch (error) {
 handleApiError(error, 'Rolling back deployment');
 }
 };

 const getStrategyIcon = (type: string) => {
 switch (type) {
 case 'blue-green': return <Globe className="w-4 h-4" />;
 case 'rolling': return <FastForward className="w-4 h-4" />;
 case 'canary': return <Shield className="w-4 h-4" />;
 case 'recreate': return <RotateCcw className="w-4 h-4" />;
 default: return <Package className="w-4 h-4" />;
 }
 };

 const getStrategyColor = (type: string) => {
 switch (type) {
 case 'blue-green': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
 case 'rolling': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
 case 'canary': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
 case 'recreate': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
 default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
 }
 };

 const getJobStatusIcon = (status: string) => {
 switch (status) {
 case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'failed': return <AlertTriangle className="w-4 h-4 text-red-600" />;
 case 'running': return <Clock className="w-4 h-4 text-blue-600 animate-pulse" />;
 case 'paused': return <Pause className="w-4 h-4 text-yellow-600" />;
 case 'pending': return <Clock className="w-4 h-4 text-gray-400" />;
 default: return <Clock className="w-4 h-4 text-gray-400" />;
 }
 };

 return (
 <DataLoadingState loading={loading} data={strategies}>
 <div className="space-y-6">
 {/* Deployment Strategies */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Deployment Strategies
 </h2>
 <button 
 onClick={() => setShowConfigModal(true)}
 className="p-2 text-gray-400 hover:text-gray-600 rounded"
 >
 <Settings className="w-4 h-4" />
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {strategies.map((strategy) => (
 <div
 key={strategy.id}
 className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
 onClick={() => setSelectedStrategy(strategy)}
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2">
 {getStrategyIcon(strategy.type)}
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {strategy.name}
 </span>
 </div>
 <span className={`px-2 py-1 text-xs rounded-full ${getStrategyColor(strategy.type)}`}>
 {strategy.type}
 </span>
 </div>
 
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
 {strategy.description}
 </p>
 
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-xs text-gray-500">
 {strategy.approvalRequired && <Shield className="w-3 h-3" />}
 {strategy.automated && <Zap className="w-3 h-3" />}
 </div>
 <button
 onClick={(e) => {
 e.stopPropagation();
 executeDeployment(strategy, 'production', 'v1.2.4');
 }}
 className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
 >
 Deploy
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Active Deployments */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Active Deployments
 </h3>
 
 {activeJobs.length > 0 ? (
 <div className="space-y-4">
 {activeJobs.map((job) => {
 const strategy = strategies.find(s => s.id === job.strategyId);
 return (
 <motion.div
 key={job.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
 >
 <div className="flex items-start justify-between mb-4">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {strategy?.name} {job.environment}
 </span>
 <div className="flex items-center gap-1">
 {getJobStatusIcon(job.status)}
 <span className="text-sm capitalize">{job.status}</span>
 </div>
 </div>
 <p className="text-sm text-gray-600 dark:text-gray-300">
 {job.currentStep}
 </p>
 </div>
 
 <div className="flex items-center gap-2">
 {job.status === 'running' && (
 <button
 onClick={() => pauseDeployment(job.id)}
 className="p-1 text-gray-400 hover:text-gray-600 rounded"
 >
 <Pause className="w-4 h-4" />
 </button>
 )}
 {job.status === 'paused' && (
 <button
 onClick={() => resumeDeployment(job.id)}
 className="p-1 text-gray-400 hover:text-gray-600 rounded"
 >
 <Play className="w-4 h-4" />
 </button>
 )}
 <button
 onClick={() => rollbackDeployment(job.id)}
 className="p-1 text-gray-400 hover:text-red-600 rounded"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Progress Bar */}
 {job.status === 'running' && (
 <div className="mb-4">
 <div className="flex justify-between text-sm mb-1">
 <span>Progress</span>
 <span>{job.progress}%</span>
 </div>
 <div className="w-full bg-gray-200 rounded-full h-2">
 <div 
 className="bg-blue-600 h-2 rounded-full transition-all duration-500"
 style={{ width: `${job.progress}%` }}
 ></div>
 </div>
 </div>
 )}

 {/* Approval Required */}
 {job.approvals && job.approvals.status === 'pending' && (
 <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
 <div className="flex items-center gap-2 mb-2">
 <Shield className="w-4 h-4 text-yellow-600" />
 <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
 Approval Required
 </span>
 </div>
 <div className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
 Pending: {job.approvals.requiredBy.filter(req => 
 !job.approvals!.approvedBy.includes(req)
 ).join(', ')}
 </div>
 <button
 onClick={() => approveDeployment(job.id, 'jane.smith@company.com')}
 className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
 >
 Approve as Jane Smith
 </button>
 </div>
 )}

 {/* Deployment Logs */}
 <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
 Recent Logs
 </h4>
 <div className="text-xs font-mono text-gray-600 dark:text-gray-300 space-y-1 max-h-32 overflow-y-auto">
 {job.logs.slice(-5).map((log, index) => (
 <div key={index}>{log}</div>
 ))}
 </div>
 </div>
 </motion.div>
 );
 })}
 </div>
 ) : (
 <p className="text-gray-500 dark:text-gray-400">No active deployments</p>
 )}
 </div>

 {/* Strategy Details Modal */}
 {selectedStrategy && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
 <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
 <div className="p-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {selectedStrategy.name}
 </h3>
 <button
 onClick={() => setSelectedStrategy(null)}
 className="text-gray-400 hover:text-gray-600"
 >
 X
 </button>
 </div>
 
 <div className="space-y-4">
 <div>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
 Configuration
 </h4>
 <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
 <pre className="text-sm text-gray-600 dark:text-gray-300">
 {JSON.stringify(selectedStrategy.config, null, 2)}
 </pre>
 </div>
 </div>
 
 <div>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
 Target Environments
 </h4>
 <div className="flex gap-2">
 {selectedStrategy.environments.map(env => (
 <span 
 key={env}
 className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
 >
 {env}
 </span>
 ))}
 </div>
 </div>
 
 <div className="flex gap-4 pt-4">
 <button
 onClick={() => {
 executeDeployment(selectedStrategy, 'staging', 'v1.2.4');
 setSelectedStrategy(null);
 }}
 className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
 >
 Deploy to Staging
 </button>
 <button
 onClick={() => {
 executeDeployment(selectedStrategy, 'production', 'v1.2.4');
 setSelectedStrategy(null);
 }}
 className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
 >
 Deploy to Production
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </DataLoadingState>
 );
}