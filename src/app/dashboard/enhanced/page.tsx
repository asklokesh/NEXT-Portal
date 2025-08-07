'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

// Removed date-fns import - using native JavaScript date manipulation instead
import { motion } from 'framer-motion';
import {
 Activity,
 AlertCircle,
 CheckCircle,
 Clock,
 GitBranch,
 Package,
 Server,
 TrendingUp,
 Users,
 Zap,
 RefreshCw,
 Settings,
 BarChart3,
 PieChart,
 LineChart,
 Bell,
 Shield,
 Database,
 Cloud,
 Cpu,
 HardDrive,
 Network,
 Calendar,
 ArrowUpRight,
 ArrowDownRight,
 AlertTriangle,
 Info,
 FileText,
 BookOpen
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

import {
 MetricCard,
 RealTimeLineChart,
 RealTimeAreaChart,
 MultiLineChart,
 StatusDistributionChart,
 DeploymentFrequencyChart,
 AlertStatusBar,
 useRealTimeData
} from '@/components/dashboard/ChartComponents';
import { backstageClient } from '@/lib/backstage/client';
import { wsClient, useWebSocket } from '@/lib/websocket/client';

interface DashboardMetrics {
 totalServices: number;
 healthyServices: number;
 deploymentsToday: number;
 incidentsToday: number;
 avgResponseTime: number;
 avgErrorRate: number;
 avgCpuUsage: number;
 avgMemoryUsage: number;
 totalRequests: number;
 activeUsers: number;
}

interface SystemHealth {
 cpu: number;
 memory: number;
 disk: number;
 network: {
 in: number;
 out: number;
 };
}

interface AlertSummary {
 severity: string;
 count: number;
}

const EnhancedDashboardPage = () => {
 const router = useRouter();
 const { isConnected } = useWebSocket();
 
 // State
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [metrics, setMetrics] = useState<DashboardMetrics>({
 totalServices: 0,
 healthyServices: 0,
 deploymentsToday: 0,
 incidentsToday: 0,
 avgResponseTime: 0,
 avgErrorRate: 0,
 avgCpuUsage: 0,
 avgMemoryUsage: 0,
 totalRequests: 0,
 activeUsers: 0,
 });
 const [systemHealth, setSystemHealth] = useState<SystemHealth>({
 cpu: 0,
 memory: 0,
 disk: 0,
 network: { in: 0, out: 0 }
 });
 const [alerts, setAlerts] = useState<AlertSummary[]>([]);
 const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

 // Real-time data hooks
 const cpuData = useRealTimeData(systemHealth.cpu, 15, 30);
 const memoryData = useRealTimeData(systemHealth.memory, 10, 30);
 const requestData = useRealTimeData(metrics.totalRequests / 100, 50, 30);
 const responseTimeData = useRealTimeData(metrics.avgResponseTime, 100, 30);

 // Load dashboard data
 const loadDashboardData = useCallback(async () => {
 try {
 setLoading(true);
 
 // Load services from Backstage
 const entities = await backstageClient.getCatalogEntities({ kind: 'Component' });
 
 // Calculate metrics
 const healthyCount = entities.filter(entity => {
 const health = entity.status?.items?.find(item => item.type === 'health');
 return health?.level === 'info';
 }).length;

 // Generate mock system metrics
 const mockSystemHealth: SystemHealth = {
 cpu: Math.random() * 100,
 memory: Math.random() * 100,
 disk: Math.random() * 100,
 network: {
 in: Math.random() * 1000,
 out: Math.random() * 1000
 }
 };

 // Generate mock alerts
 const mockAlerts: AlertSummary[] = [
 { severity: 'critical', count: Math.floor(Math.random() * 3) },
 { severity: 'high', count: Math.floor(Math.random() * 5) },
 { severity: 'medium', count: Math.floor(Math.random() * 10) },
 { severity: 'low', count: Math.floor(Math.random() * 15) },
 ].filter(alert => alert.count > 0);

 setMetrics({
 totalServices: entities.length,
 healthyServices: healthyCount,
 deploymentsToday: Math.floor(Math.random() * 20) + 5,
 incidentsToday: Math.floor(Math.random() * 5),
 avgResponseTime: Math.random() * 500 + 100,
 avgErrorRate: Math.random() * 5,
 avgCpuUsage: mockSystemHealth.cpu,
 avgMemoryUsage: mockSystemHealth.memory,
 totalRequests: Math.floor(Math.random() * 10000) + 5000,
 activeUsers: Math.floor(Math.random() * 500) + 100,
 });

 setSystemHealth(mockSystemHealth);
 setAlerts(mockAlerts);
 
 } catch (error) {
 console.error('Failed to load dashboard data:', error);
 toast.error('Failed to load dashboard data');
 } finally {
 setLoading(false);
 }
 }, []);

 // Handle refresh
 const handleRefresh = async () => {
 setRefreshing(true);
 await loadDashboardData();
 setRefreshing(false);
 toast.success('Dashboard refreshed');
 };

 // Initial load
 useEffect(() => {
 void loadDashboardData();
 }, [loadDashboardData]);

 // Real-time updates
 useEffect(() => {
 if (!isConnected) return;

 const interval = setInterval(() => {
 // Update metrics with small variations
 setMetrics(prev => ({
 ...prev,
 avgResponseTime: Math.max(50, prev.avgResponseTime + (Math.random() - 0.5) * 20),
 avgErrorRate: Math.max(0, prev.avgErrorRate + (Math.random() - 0.5) * 0.5),
 totalRequests: prev.totalRequests + Math.floor(Math.random() * 100),
 activeUsers: Math.max(0, prev.activeUsers + Math.floor((Math.random() - 0.5) * 10)),
 }));

 setSystemHealth(prev => ({
 ...prev,
 cpu: Math.max(0, Math.min(100, prev.cpu + (Math.random() - 0.5) * 10)),
 memory: Math.max(0, Math.min(100, prev.memory + (Math.random() - 0.5) * 5)),
 network: {
 in: Math.max(0, prev.network.in + (Math.random() - 0.5) * 100),
 out: Math.max(0, prev.network.out + (Math.random() - 0.5) * 100),
 }
 }));
 }, 5000);

 return () => clearInterval(interval);
 }, [isConnected]);

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 // Generate status distribution data
 const statusData = [
 { name: 'Healthy', status: 'healthy', count: metrics.healthyServices },
 { name: 'Degraded', status: 'degraded', count: Math.floor(metrics.totalServices * 0.1) },
 { name: 'Unhealthy', status: 'unhealthy', count: metrics.totalServices - metrics.healthyServices - Math.floor(metrics.totalServices * 0.1) },
 ].filter(item => item.count > 0);

 // Generate deployment frequency data
 const deploymentData = Array.from({ length: 7 }, (_, index) => {
 const date = new Date();
 date.setDate(date.getDate() - (6 - index));
 return {
 date: date.toISOString(),
 successful: Math.floor(Math.random() * 10) + 5,
 failed: Math.floor(Math.random() * 3),
 };
 });

 const healthPercentage = (metrics.healthyServices / metrics.totalServices) * 100;

 return (
 <div className="space-y-6 p-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
 Platform Dashboard
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Real-time insights into your development platform
 </p>
 </div>
 <div className="flex items-center gap-4">
 {/* Connection status */}
 <div className="flex items-center gap-2">
 <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
 <span className="text-sm text-gray-600 dark:text-gray-400">
 {isConnected ? 'Live Updates' : 'Disconnected'}
 </span>
 </div>
 
 {/* Time range selector */}
 <select
 value={timeRange}
 onChange={(e) => setTimeRange(e.target.value as any)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="1h">Last hour</option>
 <option value="24h">Last 24 hours</option>
 <option value="7d">Last 7 days</option>
 <option value="30d">Last 30 days</option>
 </select>
 
 {/* Actions */}
 <button
 onClick={handleRefresh}
 disabled={refreshing}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
 >
 <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
 </button>
 
 <button
 onClick={() => router.push('/dashboard/settings')}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
 >
 <Settings className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* Key Metrics Row */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <MetricCard
 title="Services"
 value={metrics.totalServices}
 change={{
 value: 5.2,
 period: 'vs last week',
 trend: 'up'
 }}
 status="info"
 icon={<Package className="w-6 h-6" />}
 onClick={() => router.push('/catalog')}
 />
 
 <MetricCard
 title="Platform Health"
 value={`${healthPercentage.toFixed(1)}%`}
 change={{
 value: healthPercentage > 95 ? 2.1 : -1.5,
 period: 'vs yesterday',
 trend: healthPercentage > 95 ? 'up' : 'down'
 }}
 status={healthPercentage > 95 ? 'success' : healthPercentage > 85 ? 'warning' : 'error'}
 icon={<Shield className="w-6 h-6" />}
 />
 
 <MetricCard
 title="Deployments Today"
 value={metrics.deploymentsToday}
 change={{
 value: 15.3,
 period: 'vs yesterday',
 trend: 'up'
 }}
 status="success"
 icon={<GitBranch className="w-6 h-6" />}
 onClick={() => router.push('/deployments')}
 />
 
 <MetricCard
 title="Active Incidents"
 value={metrics.incidentsToday}
 change={{
 value: metrics.incidentsToday > 3 ? 25.0 : -12.5,
 period: 'vs yesterday',
 trend: metrics.incidentsToday > 3 ? 'down' : 'up'
 }}
 status={metrics.incidentsToday === 0 ? 'success' : metrics.incidentsToday <= 2 ? 'warning' : 'error'}
 icon={<AlertCircle className="w-6 h-6" />}
 onClick={() => router.push('/incidents')}
 />
 </div>

 {/* System Performance Row */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* System Resources */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 System Resources
 </h2>
 <div className="flex items-center gap-2">
 <Cpu className="w-5 h-5 text-gray-400" />
 <span className="text-sm text-gray-500 dark:text-gray-400">Real-time</span>
 </div>
 </div>
 
 <div className="grid grid-cols-2 gap-4 mb-6">
 <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">CPU</span>
 <span className={`text-lg font-bold ${
 systemHealth.cpu > 80 ? 'text-red-600' : 
 systemHealth.cpu > 60 ? 'text-yellow-600' : 'text-green-600'
 }`}>
 {systemHealth.cpu.toFixed(1)}%
 </span>
 </div>
 <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
 <div
 className={`h-2 rounded-full transition-all duration-500 ${
 systemHealth.cpu > 80 ? 'bg-red-500' : 
 systemHealth.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(systemHealth.cpu, 100)}%` }}
 />
 </div>
 </div>
 
 <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Memory</span>
 <span className={`text-lg font-bold ${
 systemHealth.memory > 80 ? 'text-red-600' : 
 systemHealth.memory > 60 ? 'text-yellow-600' : 'text-green-600'
 }`}>
 {systemHealth.memory.toFixed(1)}%
 </span>
 </div>
 <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
 <div
 className={`h-2 rounded-full transition-all duration-500 ${
 systemHealth.memory > 80 ? 'bg-red-500' : 
 systemHealth.memory > 60 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(systemHealth.memory, 100)}%` }}
 />
 </div>
 </div>
 </div>

 <MultiLineChart
 data={cpuData.map((point, index) => ({
 timestamp: point.timestamp,
 cpu: point.value,
 memory: memoryData[index]?.value || 0
 }))}
 lines={[
 { dataKey: 'cpu', name: 'CPU %', color: '#3B82F6' },
 { dataKey: 'memory', name: 'Memory %', color: '#10B981' }
 ]}
 height={200}
 />
 </div>

 {/* Request Metrics */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Request Metrics
 </h2>
 <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
 <div className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
 <span>Requests/min</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-green-500"></div>
 <span>Response time</span>
 </div>
 </div>
 </div>
 
 <div className="grid grid-cols-3 gap-4 mb-6">
 <div className="text-center">
 <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
 {(metrics.totalRequests / 60).toFixed(0)}
 </p>
 <p className="text-sm text-gray-500 dark:text-gray-400">Req/min</p>
 </div>
 <div className="text-center">
 <p className="text-2xl font-bold text-green-600 dark:text-green-400">
 {metrics.avgResponseTime.toFixed(0)}ms
 </p>
 <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response</p>
 </div>
 <div className="text-center">
 <p className="text-2xl font-bold text-red-600 dark:text-red-400">
 {metrics.avgErrorRate.toFixed(2)}%
 </p>
 <p className="text-sm text-gray-500 dark:text-gray-400">Error Rate</p>
 </div>
 </div>

 <RealTimeAreaChart
 data={requestData}
 dataKey="value"
 name="Requests/min"
 color="#3B82F6"
 height={200}
 />
 </div>
 </div>

 {/* Activity and Alerts Row */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Service Health Distribution */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Service Health
 </h2>
 <PieChart className="w-5 h-5 text-gray-400" />
 </div>
 
 <StatusDistributionChart
 data={statusData}
 height={250}
 />
 
 <div className="mt-4 space-y-2">
 {statusData.map(item => (
 <div key={item.status} className="flex items-center justify-between">
 <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {item.count} services
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* Deployment Activity */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Deployment Activity
 </h2>
 <BarChart3 className="w-5 h-5 text-gray-400" />
 </div>
 
 <DeploymentFrequencyChart
 data={deploymentData}
 height={250}
 />
 </div>

 {/* Alert Summary */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Alert Summary
 </h2>
 <Bell className="w-5 h-5 text-gray-400" />
 </div>
 
 <AlertStatusBar alerts={alerts} />
 
 <div className="mt-6 space-y-3">
 <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-orange-500" />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 High CPU usage detected
 </span>
 </div>
 <span className="text-xs text-gray-500 dark:text-gray-400">2m ago</span>
 </div>
 
 <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex items-center gap-2">
 <Info className="w-4 h-4 text-blue-500" />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Deployment completed successfully
 </span>
 </div>
 <span className="text-xs text-gray-500 dark:text-gray-400">5m ago</span>
 </div>
 </div>
 
 <button
 onClick={() => router.push('/alerts')}
 className="w-full mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
 >
 View All Alerts
 </button>
 </div>
 </div>

 {/* Quick Actions */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
 Quick Actions
 </h2>
 
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <button
 onClick={() => router.push('/create')}
 className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
 >
 <Package className="w-8 h-8 text-gray-400" />
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
 Create Service
 </span>
 </button>
 
 <button
 onClick={() => router.push('/templates/marketplace')}
 className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
 >
 <FileText className="w-8 h-8 text-gray-400" />
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
 Browse Templates
 </span>
 </button>
 
 <button
 onClick={() => router.push('/catalog')}
 className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
 >
 <Database className="w-8 h-8 text-gray-400" />
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
 Service Catalog
 </span>
 </button>
 
 <button
 onClick={() => router.push('/docs')}
 className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
 >
 <BookOpen className="w-8 h-8 text-gray-400" />
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
 Documentation
 </span>
 </button>
 </div>
 </div>
 </div>
 );
};

export default EnhancedDashboardPage;