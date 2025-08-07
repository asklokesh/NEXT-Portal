'use client';

import { useState, useEffect } from 'react';
import { 
 Activity, 
 AlertCircle, 
 CheckCircle, 
 Clock, 
 ExternalLink, 
 GitBranch, 
 Server, 
 Database, 
 Code,
 FileText,
 Zap,
 DollarSign,
 TrendingUp,
 TrendingDown,
 BarChart3,
 Monitor,
 Settings,
 Users,
 Package,
 Layers
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from '@/components/charts';
import { toast } from 'react-hot-toast';

// Removed direct import of backstageService to avoid Node.js dependencies in client
// Using API routes instead
import { LoadingSpinner, DataLoadingState } from '@/components/ui/LoadingStates';
import { useError } from '@/contexts/ErrorContext';

import type { ServiceEntity } from '@/lib/backstage/types';

interface MetricData {
 timestamp: string;
 cpu: number;
 memory: number;
 requests: number;
 errors: number;
 responseTime: number;
}

interface Dependency {
 name: string;
 type: 'component' | 'resource' | 'api';
 status: 'healthy' | 'degraded' | 'unhealthy';
 lastCheck: string;
 responseTime?: number;
}

interface APIEndpoint {
 path: string;
 method: string;
 description: string;
 status: 'active' | 'deprecated' | 'beta';
 responseTime: number;
 successRate: number;
 requestsPerHour: number;
}

interface Deployment {
 id: string;
 version: string;
 environment: string;
 status: 'success' | 'failed' | 'in_progress' | 'rolled_back';
 startTime: string;
 endTime?: string;
 author: string;
 commitHash: string;
 description: string;
}

// Enhanced Overview Tab
export function EnhancedOverviewTab({ entity }: { entity: ServiceEntity }) {
 const [dependencies, setDependencies] = useState<Dependency[]>([]);
 const [metrics, setMetrics] = useState<MetricData[]>([]);
 const [loading, setLoading] = useState(true);
 const { handleApiError } = useError();

 useEffect(() => {
 const loadOverviewData = async () => {
 try {
 setLoading(true);
 
 // Load dependencies
 const response = await fetch(`/api/catalog/entities/by-name/${entity.kind}/${entity.metadata.namespace || 'default'}/${entity.metadata.name}/relations`);
 if (!response.ok) {
 throw new Error('Failed to fetch relations');
 }
 const relations = await response.json();
 const depsData = relations.map(rel => ({
 name: rel.targetRef || rel.target?.name || 'Unknown',
 type: rel.target?.kind?.toLowerCase() as 'component' | 'resource' | 'api',
 status: 'healthy' as const,
 lastCheck: new Date().toISOString(),
 responseTime: Math.random() * 100 + 50
 }));
 setDependencies(depsData);

 // Generate mock metrics data
 const metricsData = Array.from({ length: 24 }, (_, i) => ({
 timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
 cpu: Math.random() * 80 + 10,
 memory: Math.random() * 70 + 20,
 requests: Math.floor(Math.random() * 1000 + 100),
 errors: Math.floor(Math.random() * 10),
 responseTime: Math.random() * 200 + 50
 }));
 setMetrics(metricsData);
 } catch (error) {
 handleApiError(error, 'Loading overview data');
 } finally {
 setLoading(false);
 }
 };

 loadOverviewData();
 }, [entity.metadata.name, handleApiError]);

 const currentMetrics = metrics[metrics.length - 1];
 const previousMetrics = metrics[metrics.length - 2];

 const getMetricTrend = (current: number, previous: number) => {
 if (!previous) return 'stable';
 const change = ((current - previous) / previous) * 100;
 return change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
 };

 return (
 <DataLoadingState loading={loading} data={metrics}>
 <div className="space-y-6">
 {/* Service Description */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Service Overview
 </h2>
 <div className="prose dark:prose-invert max-w-none">
 <p className="text-gray-600 dark:text-gray-300">
 {entity.metadata.description || 'No description available for this service.'}
 </p>
 </div>
 </div>

 {/* Key Metrics */}
 {currentMetrics && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { 
 title: 'CPU Usage', 
 value: `${currentMetrics.cpu.toFixed(1)}%`, 
 trend: getMetricTrend(currentMetrics.cpu, previousMetrics?.cpu || 0),
 icon: Activity
 },
 { 
 title: 'Memory Usage', 
 value: `${currentMetrics.memory.toFixed(1)}%`, 
 trend: getMetricTrend(currentMetrics.memory, previousMetrics?.memory || 0),
 icon: Server
 },
 { 
 title: 'Requests/Hour', 
 value: currentMetrics.requests.toString(), 
 trend: getMetricTrend(currentMetrics.requests, previousMetrics?.requests || 0),
 icon: BarChart3
 },
 { 
 title: 'Response Time', 
 value: `${currentMetrics.responseTime.toFixed(0)}ms`, 
 trend: getMetricTrend(currentMetrics.responseTime, previousMetrics?.responseTime || 0),
 icon: Clock
 }
 ].map((metric, index) => (
 <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between mb-2">
 <metric.icon className="w-5 h-5 text-gray-500" />
 {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
 {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
 </div>
 <p className="text-sm text-gray-500 dark:text-gray-400">{metric.title}</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</p>
 </div>
 ))}
 </div>
 )}

 {/* Performance Chart */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 24-Hour Performance
 </h3>
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={metrics}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis 
 dataKey="timestamp" 
 tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 />
 <YAxis />
 <Tooltip 
 labelFormatter={(value) => new Date(value).toLocaleString()}
 formatter={(value: number, name: string) => [
 name === 'responseTime' ? `${value.toFixed(0)}ms` : 
 name === 'requests' ? value.toString() :
 `${value.toFixed(1)}%`,
 name === 'cpu' ? 'CPU' :
 name === 'memory' ? 'Memory' :
 name === 'responseTime' ? 'Response Time' :
 'Requests'
 ]}
 />
 <Line type="monotone" dataKey="cpu" stroke="#8884d8" strokeWidth={2} />
 <Line type="monotone" dataKey="memory" stroke="#82ca9d" strokeWidth={2} />
 <Line type="monotone" dataKey="responseTime" stroke="#ffc658" strokeWidth={2} />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Dependencies Status */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Dependencies Health
 </h3>
 <div className="space-y-3">
 {dependencies.length > 0 ? (
 dependencies.map((dep, index) => (
 <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex items-center gap-3">
 {dep.type === 'component' && <Package className="w-4 h-4 text-blue-500" />}
 {dep.type === 'resource' && <Database className="w-4 h-4 text-green-500" />}
 {dep.type === 'api' && <Zap className="w-4 h-4 text-purple-500" />}
 <div>
 <p className="font-medium text-gray-900 dark:text-gray-100">{dep.name}</p>
 <p className="text-sm text-gray-500">{dep.type}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {dep.responseTime && (
 <span className="text-sm text-gray-500">{dep.responseTime.toFixed(0)}ms</span>
 )}
 <div className="flex items-center gap-1">
 {dep.status === 'healthy' && <CheckCircle className="w-4 h-4 text-green-500" />}
 {dep.status === 'degraded' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
 {dep.status === 'unhealthy' && <AlertCircle className="w-4 h-4 text-red-500" />}
 <span className="text-sm capitalize">{dep.status}</span>
 </div>
 </div>
 </div>
 ))
 ) : (
 <p className="text-gray-500 dark:text-gray-400">No dependencies detected</p>
 )}
 </div>
 </div>
 </div>
 </DataLoadingState>
 );
}

// Enhanced APIs Tab
export function EnhancedAPIsTab({ entity }: { entity: ServiceEntity }) {
 const [apis, setApis] = useState<APIEndpoint[]>([]);
 const [loading, setLoading] = useState(true);
 const { handleApiError } = useError();

 useEffect(() => {
 const loadAPIs = async () => {
 try {
 setLoading(true);
 
 // Generate mock API data based on entity spec
 const mockAPIs = [
 {
 path: '/api/v1/health',
 method: 'GET',
 description: 'Health check endpoint',
 status: 'active' as const,
 responseTime: 45,
 successRate: 99.9,
 requestsPerHour: 240
 },
 {
 path: '/api/v1/users',
 method: 'GET',
 description: 'List all users',
 status: 'active' as const,
 responseTime: 120,
 successRate: 99.2,
 requestsPerHour: 1800
 },
 {
 path: '/api/v1/users/{id}',
 method: 'GET',
 description: 'Get user by ID',
 status: 'active' as const,
 responseTime: 85,
 successRate: 98.8,
 requestsPerHour: 3200
 },
 {
 path: '/api/v1/metrics',
 method: 'GET',
 description: 'Service metrics endpoint',
 status: 'beta' as const,
 responseTime: 200,
 successRate: 97.5,
 requestsPerHour: 150
 }
 ];
 
 setApis(mockAPIs);
 } catch (error) {
 handleApiError(error, 'Loading API data');
 } finally {
 setLoading(false);
 }
 };

 loadAPIs();
 }, [entity.metadata.name, handleApiError]);

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
 case 'deprecated': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
 case 'beta': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
 default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
 }
 };

 const getMethodColor = (method: string) => {
 switch (method) {
 case 'GET': return 'bg-green-100 text-green-800';
 case 'POST': return 'bg-blue-100 text-blue-800';
 case 'PUT': return 'bg-orange-100 text-orange-800';
 case 'DELETE': return 'bg-red-100 text-red-800';
 default: return 'bg-gray-100 text-gray-800';
 }
 };

 return (
 <DataLoadingState loading={loading} data={apis}>
 <div className="space-y-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 API Endpoints
 </h2>
 
 <div className="space-y-4">
 {apis.map((api, index) => (
 <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(api.method)}`}>
 {api.method}
 </span>
 <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
 {api.path}
 </code>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(api.status)}`}>
 {api.status}
 </span>
 </div>
 <ExternalLink className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
 </div>
 
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
 {api.description}
 </p>
 
 <div className="grid grid-cols-3 gap-4 text-sm">
 <div>
 <span className="text-gray-500">Response Time</span>
 <p className="font-medium">{api.responseTime}ms</p>
 </div>
 <div>
 <span className="text-gray-500">Success Rate</span>
 <p className="font-medium">{api.successRate}%</p>
 </div>
 <div>
 <span className="text-gray-500">Requests/Hour</span>
 <p className="font-medium">{api.requestsPerHour.toLocaleString()}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </DataLoadingState>
 );
}

// Enhanced Deployments Tab
export function EnhancedDeploymentsTab({ entityRef }: { entityRef: string }) {
 const [deployments, setDeployments] = useState<Deployment[]>([]);
 const [loading, setLoading] = useState(true);
 const { handleApiError } = useError();

 useEffect(() => {
 const loadDeployments = async () => {
 try {
 setLoading(true);
 
 // Generate mock deployment data
 const mockDeployments = Array.from({ length: 10 }, (_, i) => ({
 id: `deploy-${i + 1}`,
 version: `v1.${20 - i}.${Math.floor(Math.random() * 10)}`,
 environment: ['production', 'staging', 'development'][i % 3],
 status: (['success', 'failed', 'in_progress'] as const)[Math.floor(Math.random() * 3)],
 startTime: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
 endTime: new Date(Date.now() - i * 24 * 60 * 60 * 1000 + Math.random() * 60 * 60 * 1000).toISOString(),
 author: ['john.doe', 'jane.smith', 'bob.wilson'][Math.floor(Math.random() * 3)],
 commitHash: Math.random().toString(36).substr(2, 8),
 description: `Deploy ${['feature update', 'bug fixes', 'performance improvements'][Math.floor(Math.random() * 3)]}`
 }));
 
 setDeployments(mockDeployments);
 } catch (error) {
 handleApiError(error, 'Loading deployment data');
 } finally {
 setLoading(false);
 }
 };

 loadDeployments();
 }, [entityRef, handleApiError]);

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
 case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
 case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
 case 'rolled_back': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
 default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
 }
 };

 const getEnvironmentColor = (env: string) => {
 switch (env) {
 case 'production': return 'bg-red-100 text-red-800';
 case 'staging': return 'bg-yellow-100 text-yellow-800';
 case 'development': return 'bg-blue-100 text-blue-800';
 default: return 'bg-gray-100 text-gray-800';
 }
 };

 return (
 <DataLoadingState loading={loading} data={deployments}>
 <div className="space-y-6">
 {/* Deployment Pipeline Visualization */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Deployment Pipeline
 </h2>
 <div className="flex items-center justify-between">
 {['Development', 'Staging', 'Production'].map((env, index) => (
 <div key={env} className="flex items-center">
 <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
 env === 'Development' ? 'bg-blue-100 text-blue-800' :
 env === 'Staging' ? 'bg-yellow-100 text-yellow-800' :
 'bg-red-100 text-red-800'
 }`}>
 <span className="text-sm font-medium">{env[0]}</span>
 </div>
 <div className="ml-3">
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{env}</p>
 <p className="text-xs text-gray-500">
 {deployments.find(d => d.environment === env.toLowerCase())?.version || 'No deployment'}
 </p>
 </div>
 {index < 2 && (
 <div className="w-16 h-0.5 bg-gray-300 dark:bg-gray-600 mx-4"></div>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Deployment History */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Deployment History
 </h2>
 
 <div className="space-y-4">
 {deployments.map((deployment) => (
 <div key={deployment.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
 {deployment.version}
 </span>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEnvironmentColor(deployment.environment)}`}>
 {deployment.environment}
 </span>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(deployment.status)}`}>
 {deployment.status.replace('_', ' ')}
 </span>
 </div>
 <div className="text-sm text-gray-500">
 {new Date(deployment.startTime).toLocaleString()}
 </div>
 </div>
 
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
 {deployment.description}
 </p>
 
 <div className="flex items-center justify-between text-xs text-gray-500">
 <span>By {deployment.author}</span>
 <span className="font-mono">{deployment.commitHash}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </DataLoadingState>
 );
}