'use client';

import { useState, useEffect } from 'react';
import { 
 Activity, 
 TrendingUp, 
 TrendingDown, 
 AlertTriangle, 
 CheckCircle,
 Clock,
 Server,
 Database,
 Globe,
 GitBranch,
 Users,
 Zap,
 BarChart3
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from '@/components/charts';

import { DataLoadingState } from '@/components/ui/LoadingStates';
import { useError } from '@/contexts/ErrorContext';

interface DeploymentMetrics {
 timestamp: string;
 deploymentFrequency: number;
 leadTime: number; // minutes
 failureRate: number; // percentage
 recoveryTime: number; // minutes
 successRate: number;
}

interface EnvironmentHealth {
 environment: string;
 status: 'healthy' | 'degraded' | 'unhealthy';
 uptime: number;
 responseTime: number;
 errorRate: number;
 instances: number;
 lastDeployment: string;
 version: string;
}

interface DeploymentTrend {
 period: string;
 deployments: number;
 successes: number;
 failures: number;
 averageTime: number;
}

export function DeploymentMonitoring({ 
 serviceRef,
 timeRange = '7d' 
}: { 
 serviceRef: string;
 timeRange?: '1d' | '7d' | '30d';
}) {
 const [metrics, setMetrics] = useState<DeploymentMetrics[]>([]);
 const [environments, setEnvironments] = useState<EnvironmentHealth[]>([]);
 const [trends, setTrends] = useState<DeploymentTrend[]>([]);
 const [loading, setLoading] = useState(true);
 const { handleApiError } = useError();

 useEffect(() => {
 loadMonitoringData();
 }, [serviceRef, timeRange]);

 const loadMonitoringData = async () => {
 try {
 setLoading(true);
 
 // Generate mock metrics data
 const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : 30;
 const metricsData = Array.from({ length: days * 4 }, (_, i) => ({
 timestamp: new Date(Date.now() - (days * 4 - i) * 6 * 60 * 60 * 1000).toISOString(),
 deploymentFrequency: Math.floor(Math.random() * 5 + 1),
 leadTime: Math.floor(Math.random() * 120 + 30),
 failureRate: Math.random() * 15,
 recoveryTime: Math.floor(Math.random() * 60 + 10),
 successRate: Math.random() * 10 + 90
 }));
 setMetrics(metricsData);

 // Mock environment health data
 const envData: EnvironmentHealth[] = [
 {
 environment: 'production',
 status: 'healthy',
 uptime: 99.9,
 responseTime: 145,
 errorRate: 0.1,
 instances: 6,
 lastDeployment: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
 version: 'v1.2.3'
 },
 {
 environment: 'staging',
 status: 'healthy',
 uptime: 98.5,
 responseTime: 180,
 errorRate: 0.5,
 instances: 2,
 lastDeployment: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
 version: 'v1.2.4-rc.1'
 },
 {
 environment: 'development',
 status: 'degraded',
 uptime: 95.2,
 responseTime: 220,
 errorRate: 2.1,
 instances: 1,
 lastDeployment: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
 version: 'v1.2.4-dev.5'
 }
 ];
 setEnvironments(envData);

 // Mock deployment trends
 const trendData: DeploymentTrend[] = Array.from({ length: 12 }, (_, i) => ({
 period: new Date(Date.now() - (11 - i) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
 deployments: Math.floor(Math.random() * 20 + 5),
 successes: Math.floor(Math.random() * 18 + 4),
 failures: Math.floor(Math.random() * 3),
 averageTime: Math.floor(Math.random() * 60 + 30)
 }));
 setTrends(trendData);

 } catch (error) {
 handleApiError(error, 'Loading deployment monitoring data');
 } finally {
 setLoading(false);
 }
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'healthy': return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
 case 'unhealthy': return <AlertTriangle className="w-4 h-4 text-red-600" />;
 default: return <Clock className="w-4 h-4 text-gray-400" />;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'healthy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
 case 'degraded': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
 case 'unhealthy': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
 default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
 }
 };

 const currentMetrics = metrics[metrics.length - 1];
 const previousMetrics = metrics[metrics.length - 8] || metrics[0]; // Compare with 2 days ago

 const calculateTrend = (current: number, previous: number) => {
 if (!previous) return 0;
 return ((current - previous) / previous) * 100;
 };

 return (
 <DataLoadingState loading={loading} data={metrics}>
 <div className="space-y-6">
 {/* Key Metrics Overview */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {currentMetrics && [
 {
 title: 'Deployment Frequency',
 value: `${currentMetrics.deploymentFrequency}/day`,
 trend: calculateTrend(currentMetrics.deploymentFrequency, previousMetrics?.deploymentFrequency || 0),
 icon: GitBranch,
 color: 'blue'
 },
 {
 title: 'Lead Time',
 value: `${currentMetrics.leadTime}min`,
 trend: calculateTrend(currentMetrics.leadTime, previousMetrics?.leadTime || 0),
 icon: Clock,
 color: 'purple',
 inverse: true
 },
 {
 title: 'Success Rate',
 value: `${currentMetrics.successRate.toFixed(1)}%`,
 trend: calculateTrend(currentMetrics.successRate, previousMetrics?.successRate || 0),
 icon: CheckCircle,
 color: 'green'
 },
 {
 title: 'Recovery Time',
 value: `${currentMetrics.recoveryTime}min`,
 trend: calculateTrend(currentMetrics.recoveryTime, previousMetrics?.recoveryTime || 0),
 icon: Activity,
 color: 'orange',
 inverse: true
 }
 ].map((metric, index) => (
 <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between mb-2">
 <metric.icon className={`w-5 h-5 text-${metric.color}-600`} />
 <div className="flex items-center text-sm">
 {metric.trend > 0 ? (
 <TrendingUp className={`w-4 h-4 ${
 metric.inverse ? 'text-red-500' : 'text-green-500'
 }`} />
 ) : metric.trend < 0 ? (
 <TrendingDown className={`w-4 h-4 ${
 metric.inverse ? 'text-green-500' : 'text-red-500'
 }`} />
 ) : null}
 <span className={`ml-1 ${
 metric.trend > 0 ? (metric.inverse ? 'text-red-600' : 'text-green-600') :
 metric.trend < 0 ? (metric.inverse ? 'text-green-600' : 'text-red-600') :
 'text-gray-500'
 }`}>
 {Math.abs(metric.trend).toFixed(1)}%
 </span>
 </div>
 </div>
 <p className="text-sm text-gray-500 dark:text-gray-400">{metric.title}</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</p>
 </div>
 ))}
 </div>

 {/* Environment Health */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Environment Health
 </h3>
 
 <div className="space-y-4">
 {environments.map((env) => (
 <div key={env.environment} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-lg ${
 env.environment === 'production' ? 'bg-red-100' :
 env.environment === 'staging' ? 'bg-yellow-100' :
 'bg-blue-100'
 }`}>
 <Server className={`w-4 h-4 ${
 env.environment === 'production' ? 'text-red-600' :
 env.environment === 'staging' ? 'text-yellow-600' :
 'text-blue-600'
 }`} />
 </div>
 <div>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
 {env.environment}
 </h4>
 <p className="text-sm text-gray-500">Version: {env.version}</p>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(env.status)}`}>
 {getStatusIcon(env.status)}
 <span className="ml-1">{env.status}</span>
 </span>
 </div>
 </div>
 
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
 <div>
 <span className="text-gray-500">Uptime</span>
 <p className="font-medium">{env.uptime}%</p>
 </div>
 <div>
 <span className="text-gray-500">Response Time</span>
 <p className="font-medium">{env.responseTime}ms</p>
 </div>
 <div>
 <span className="text-gray-500">Error Rate</span>
 <p className="font-medium">{env.errorRate}%</p>
 </div>
 <div>
 <span className="text-gray-500">Instances</span>
 <p className="font-medium">{env.instances}</p>
 </div>
 <div>
 <span className="text-gray-500">Last Deploy</span>
 <p className="font-medium">
 {new Date(env.lastDeployment).toLocaleTimeString()}
 </p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Deployment Metrics Chart */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Deployment Metrics Over Time
 </h3>
 
 <div className="h-64 mb-4">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={metrics}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis 
 dataKey="timestamp" 
 tickFormatter={(value) => new Date(value).toLocaleDateString()}
 />
 <YAxis />
 <Tooltip 
 labelFormatter={(value) => new Date(value).toLocaleDateString()}
 formatter={(value: number, name: string) => [
 name === 'deploymentFrequency' ? `${value}/day` :
 name === 'leadTime' || name === 'recoveryTime' ? `${value}min` :
 `${value.toFixed(1)}%`,
 name === 'deploymentFrequency' ? 'Frequency' :
 name === 'leadTime' ? 'Lead Time' :
 name === 'failureRate' ? 'Failure Rate' :
 name === 'recoveryTime' ? 'Recovery Time' :
 'Success Rate'
 ]}
 />
 <Line type="monotone" dataKey="successRate" stroke="#10b981" strokeWidth={2} />
 <Line type="monotone" dataKey="failureRate" stroke="#ef4444" strokeWidth={2} />
 <Line type="monotone" dataKey="leadTime" stroke="#8b5cf6" strokeWidth={2} />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Deployment Trends */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Weekly Deployment Trends
 </h3>
 
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={trends}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="period" />
 <YAxis />
 <Tooltip />
 <Area 
 type="monotone" 
 dataKey="successes" 
 stackId="1"
 stroke="#10b981" 
 fill="#10b981" 
 fillOpacity={0.6}
 />
 <Area 
 type="monotone" 
 dataKey="failures" 
 stackId="1"
 stroke="#ef4444" 
 fill="#ef4444" 
 fillOpacity={0.6}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* DORA Metrics Summary */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 DORA Metrics Summary
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Velocity</h4>
 <div className="space-y-2">
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-600 dark:text-gray-300">Deployment Frequency</span>
 <span className="text-sm font-medium">Daily</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-600 dark:text-gray-300">Lead Time for Changes</span>
 <span className="text-sm font-medium">2.5 hours</span>
 </div>
 </div>
 </div>
 
 <div>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Stability</h4>
 <div className="space-y-2">
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-600 dark:text-gray-300">Change Failure Rate</span>
 <span className="text-sm font-medium">5.2%</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-600 dark:text-gray-300">Time to Restore Service</span>
 <span className="text-sm font-medium">45 minutes</span>
 </div>
 </div>
 </div>
 </div>
 
 <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
 <div className="flex items-start gap-3">
 <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
 <div>
 <h5 className="font-medium text-blue-900 dark:text-blue-200">Performance Rating</h5>
 <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
 Your deployment performance is in the <strong>High</strong> category according to DORA metrics.
 You're deploying multiple times per day with low failure rates and fast recovery times.
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </DataLoadingState>
 );
}