'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

// Removed date-fns import - using native JavaScript date formatting instead
import { motion } from 'framer-motion';
import {
 TrendingUp,
 TrendingDown,
 Activity,
 Clock,
 AlertTriangle,
 CheckCircle,
 Zap,
 Database as _Database,
 Settings as _Settings,
 Calendar as _Calendar,
 Filter as _Filter,
 Download,
 RefreshCw,
 BarChart3 as _BarChart3,
 PieChart as _PieChartIcon,
 Target
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
 BarChart as _BarChart,
 Bar as _Bar,
 LineChart,
 Line,
 AreaChart,
 Area,
 PieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
 ScatterChart,
 Scatter
} from '@/components/charts';

interface ServiceMetrics {
 timestamp: string;
 serviceName: string;
 responseTime: number;
 throughput: number;
 errorRate: number;
 availability: number;
 cpuUsage: number;
 memoryUsage: number;
 activeConnections: number;
 deployments: number;
}

interface AggregatedMetrics {
 avgResponseTime: number;
 totalThroughput: number;
 avgErrorRate: number;
 avgAvailability: number;
 totalDeployments: number;
 criticalIssues: number;
 healthyServices: number;
 totalServices: number;
}

interface PerformanceTrend {
 timestamp: string;
 responseTime: number;
 throughput: number;
 errorRate: number;
 availability: number;
}

interface ServiceAnalyticsDashboardProps {
 serviceRef?: string;
 timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
 showComparison?: boolean;
}

export const ServiceAnalyticsDashboard = ({
 serviceRef,
 timeRange = '24h',
 showComparison: _showComparison = false
}: ServiceAnalyticsDashboardProps) => {
 const [loading, setLoading] = useState(true);
 const [metrics, setMetrics] = useState<ServiceMetrics[]>([]);
 const [aggregated, setAggregated] = useState<AggregatedMetrics | null>(null);
 const [trends, setTrends] = useState<PerformanceTrend[]>([]);
 const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
 const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'reliability' | 'capacity'>('overview');
 const [refreshInterval, _setRefreshInterval] = useState<number | null>(30000);

 const loadAnalyticsData = useCallback(async (): Promise<void> => {
 try {
 setLoading(true);
 
 // Generate mock analytics data - adding await to simulate API call
 await new Promise(resolve => setTimeout(resolve, 100));
 const mockData = generateMockAnalyticsData(selectedTimeRange, serviceRef);
 setMetrics(mockData.metrics);
 setAggregated(mockData.aggregated);
 setTrends(mockData.trends);
 } catch (error) {
 console.error('Failed to load analytics data:', error);
 toast.error('Failed to load analytics data');
 } finally {
 setLoading(false);
 }
 }, [selectedTimeRange, serviceRef]);

 useEffect(() => {
 void loadAnalyticsData();
 
 if (refreshInterval) {
 const interval = setInterval(() => void loadAnalyticsData(), refreshInterval);
 return () => clearInterval(interval);
 }
 }, [serviceRef, selectedTimeRange, refreshInterval, loadAnalyticsData]);

 const generateMockAnalyticsData = (range: string, service?: string) => {
 const now = new Date();
 const getTimePoints = () => {
 switch (range) {
 case '1h': return 12; // Every 5 minutes
 case '6h': return 24; // Every 15 minutes
 case '24h': return 48; // Every 30 minutes
 case '7d': return 168; // Every hour
 case '30d': return 720; // Every hour
 default: return 48;
 }
 };

 const getTimeIncrement = () => {
 switch (range) {
 case '1h': return 5 * 60 * 1000; // 5 minutes
 case '6h': return 15 * 60 * 1000; // 15 minutes
 case '24h': return 30 * 60 * 1000; // 30 minutes
 case '7d': return 60 * 60 * 1000; // 1 hour
 case '30d': return 60 * 60 * 1000; // 1 hour
 default: return 30 * 60 * 1000;
 }
 };

 const timePoints = getTimePoints();
 const increment = getTimeIncrement();
 
 const services = service ? [service] : [
 'user-service',
 'order-service',
 'payment-service',
 'notification-service',
 'inventory-service'
 ];

 const metrics: ServiceMetrics[] = [];
 const trends: PerformanceTrend[] = [];

 for (let i = timePoints; i >= 0; i--) {
 const timestamp = new Date(now.getTime() - (i * increment)).toISOString();
 
 // Add some variance and trends
 const timeProgression = (timePoints - i) / timePoints;
 const cyclicVariation = Math.sin(timeProgression * Math.PI * 4) * 0.2;
 
 services.forEach((serviceName, serviceIndex) => {
 const baseResponseTime = 50 + serviceIndex * 20;
 const baseThroughput = 100 + serviceIndex * 50;
 const baseErrorRate = 0.5 + serviceIndex * 0.3;
 
 const responseTime = Math.max(10, baseResponseTime + 
 (Math.random() - 0.5) * 40 + 
 cyclicVariation * 20 +
 (timeProgression * 10)); // Slight upward trend
 
 const throughput = Math.max(10, baseThroughput + 
 (Math.random() - 0.5) * 60 + 
 cyclicVariation * 30);
 
 const errorRate = Math.max(0, Math.min(10, baseErrorRate + 
 (Math.random() - 0.5) * 2 + 
 cyclicVariation * 1));

 metrics.push({
 timestamp,
 serviceName,
 responseTime,
 throughput,
 errorRate,
 availability: Math.max(95, 99.9 - errorRate * 0.5 + (Math.random() - 0.5) * 2),
 cpuUsage: Math.max(0, Math.min(100, 30 + (Math.random() - 0.5) * 40 + cyclicVariation * 20)),
 memoryUsage: Math.max(0, Math.min(100, 40 + (Math.random() - 0.5) * 30 + cyclicVariation * 15)),
 activeConnections: Math.max(0, Math.floor(50 + (Math.random() - 0.5) * 100 + cyclicVariation * 30)),
 deployments: Math.random() < 0.05 ? 1 : 0 // 5% chance of deployment
 });
 });

 // Aggregate trends
 const currentMetrics = metrics.filter(m => m.timestamp === timestamp);
 trends.push({
 timestamp,
 responseTime: currentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / currentMetrics.length,
 throughput: currentMetrics.reduce((sum, m) => sum + m.throughput, 0),
 errorRate: currentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / currentMetrics.length,
 availability: currentMetrics.reduce((sum, m) => sum + m.availability, 0) / currentMetrics.length,
 });
 }

 // Calculate aggregated metrics
 const recentMetrics = metrics.slice(-services.length); // Last data point for each service
 const aggregated: AggregatedMetrics = {
 avgResponseTime: recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length,
 totalThroughput: recentMetrics.reduce((sum, m) => sum + m.throughput, 0),
 avgErrorRate: recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length,
 avgAvailability: recentMetrics.reduce((sum, m) => sum + m.availability, 0) / recentMetrics.length,
 totalDeployments: metrics.reduce((sum, m) => sum + m.deployments, 0),
 criticalIssues: recentMetrics.filter(m => m.errorRate > 3 || m.responseTime > 200).length,
 healthyServices: recentMetrics.filter(m => m.availability > 99.5 && m.errorRate < 1).length,
 totalServices: services.length
 };

 return { metrics, aggregated, trends };
 };

 const formatTimestamp = (timestamp: string) => {
 const date = new Date(timestamp);
 switch (selectedTimeRange) {
 case '1h':
 case '6h':
 return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
 case '24h':
 return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
 case '7d':
 return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
 case '30d':
 return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
 default:
 return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
 }
 };

 const getServiceHealthDistribution = () => {
 if (!aggregated) return [];
 
 return [
 { name: 'Healthy', value: aggregated.healthyServices, color: '#10B981' },
 { name: 'Degraded', value: aggregated.totalServices - aggregated.healthyServices - aggregated.criticalIssues, color: '#F59E0B' },
 { name: 'Critical', value: aggregated.criticalIssues, color: '#EF4444' }
 ];
 };

 const getPerformanceByService = () => {
 const serviceGroups = new Map<string, ServiceMetrics[]>();
 
 metrics.forEach(metric => {
 if (!serviceGroups.has(metric.serviceName)) {
 serviceGroups.set(metric.serviceName, []);
 }
 serviceGroups.get(metric.serviceName)!.push(metric);
 });

 return Array.from(serviceGroups.entries()).map(([serviceName, serviceMetrics]) => {
 const recent = serviceMetrics.slice(-1)[0] || serviceMetrics[0];
 return {
 name: serviceName.replace('-service', ''),
 responseTime: recent?.responseTime || 0,
 throughput: recent?.throughput || 0,
 errorRate: recent?.errorRate || 0,
 availability: recent?.availability || 0
 };
 });
 };

 const handleExport = () => {
 const data = {
 timeRange: selectedTimeRange,
 aggregated,
 trends,
 exportedAt: new Date().toISOString()
 };
 
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `analytics-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.json`;
 link.click();
 URL.revokeObjectURL(url);
 
 toast.success('Analytics data exported successfully');
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Service Analytics
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Performance insights and trends for your services
 </p>
 </div>

 <div className="flex flex-wrap items-center gap-3">
 {/* Time Range Selector */}
 <select
 value={selectedTimeRange}
 onChange={(e) => setSelectedTimeRange(e.target.value as '1h' | '6h' | '24h' | '7d' | '30d')}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="1h">Last Hour</option>
 <option value="6h">Last 6 Hours</option>
 <option value="24h">Last 24 Hours</option>
 <option value="7d">Last 7 Days</option>
 <option value="30d">Last 30 Days</option>
 </select>

 {/* View Selector */}
 <select
 value={selectedView}
 onChange={(e) => setSelectedView(e.target.value as 'overview' | 'performance' | 'reliability' | 'capacity')}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="overview">Overview</option>
 <option value="performance">Performance</option>
 <option value="reliability">Reliability</option>
 <option value="capacity">Capacity</option>
 </select>

 {/* Refresh Control */}
 <button
 onClick={() => void loadAnalyticsData()}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Refresh data"
 >
 <RefreshCw className="w-5 h-5" />
 </button>

 {/* Export */}
 <button
 onClick={handleExport}
 className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <Download className="w-4 h-4" />
 Export
 </button>
 </div>
 </div>

 {/* Key Metrics Cards */}
 {aggregated && (
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
 <MetricCard
 title="Avg Response Time"
 value={`${aggregated.avgResponseTime.toFixed(0)}ms`}
 trend={aggregated.avgResponseTime < 100 ? 'up' : 'down'}
 icon={<Clock className="w-5 h-5" />}
 color="blue"
 />
 <MetricCard
 title="Total Throughput"
 value={`${aggregated.totalThroughput.toFixed(0)}/s`}
 trend="up"
 icon={<Zap className="w-5 h-5" />}
 color="green"
 />
 <MetricCard
 title="Error Rate"
 value={`${aggregated.avgErrorRate.toFixed(2)}%`}
 trend={aggregated.avgErrorRate < 1 ? 'up' : 'down'}
 icon={<AlertTriangle className="w-5 h-5" />}
 color="red"
 />
 <MetricCard
 title="Availability"
 value={`${aggregated.avgAvailability.toFixed(2)}%`}
 trend="up"
 icon={<CheckCircle className="w-5 h-5" />}
 color="green"
 />
 <MetricCard
 title="Deployments"
 value={aggregated.totalDeployments.toString()}
 trend="neutral"
 icon={<Activity className="w-5 h-5" />}
 color="purple"
 />
 <MetricCard
 title="Healthy Services"
 value={`${aggregated.healthyServices}/${aggregated.totalServices}`}
 trend="up"
 icon={<Target className="w-5 h-5" />}
 color="green"
 />
 </div>
 )}

 {/* Charts Section */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Performance Trends */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Performance Trends
 </h3>
 <ResponsiveContainer width="100%" height={300}>
 <LineChart data={trends}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis 
 dataKey="timestamp" 
 tickFormatter={formatTimestamp}
 fontSize={12}
 />
 <YAxis fontSize={12} />
 <Tooltip 
 labelFormatter={(value) => formatTimestamp(value as string)}
 formatter={(value: number, name: string) => [
 name === 'responseTime' ? `${value.toFixed(0)}ms` :
 name === 'throughput' ? `${value.toFixed(0)}/s` :
 name === 'errorRate' ? `${value.toFixed(2)}%` :
 name === 'availability' ? `${value.toFixed(2)}%` :
 value.toFixed(2),
 name
 ]}
 />
 <Legend />
 <Line 
 type="monotone" 
 dataKey="responseTime" 
 stroke="#3B82F6" 
 strokeWidth={2}
 name="Response Time"
 />
 <Line 
 type="monotone" 
 dataKey="errorRate" 
 stroke="#EF4444" 
 strokeWidth={2}
 name="Error Rate"
 />
 </LineChart>
 </ResponsiveContainer>
 </div>

 {/* Service Health Distribution */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Service Health Distribution
 </h3>
 <ResponsiveContainer width="100%" height={300}>
 <PieChart>
 <Pie
 data={getServiceHealthDistribution()}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={120}
 paddingAngle={5}
 dataKey="value"
 >
 {getServiceHealthDistribution().map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </div>

 {/* Throughput vs Response Time */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Throughput vs Response Time
 </h3>
 <ResponsiveContainer width="100%" height={300}>
 <ScatterChart data={getPerformanceByService()}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis 
 dataKey="throughput" 
 name="Throughput"
 unit="/s"
 fontSize={12}
 />
 <YAxis 
 dataKey="responseTime" 
 name="Response Time"
 unit="ms"
 fontSize={12}
 />
 <Tooltip 
 cursor={{ strokeDasharray: '3 3' }}
 formatter={(value: number, name: string) => [
 name === 'throughput' ? `${value.toFixed(0)}/s` :
 name === 'responseTime' ? `${value.toFixed(0)}ms` :
 value.toFixed(2),
 name
 ]}
 />
 <Scatter name="Services" dataKey="responseTime" fill="#8884D8" />
 </ScatterChart>
 </ResponsiveContainer>
 </div>

 {/* Availability Trends */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Availability & Throughput
 </h3>
 <ResponsiveContainer width="100%" height={300}>
 <AreaChart data={trends}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis 
 dataKey="timestamp" 
 tickFormatter={formatTimestamp}
 fontSize={12}
 />
 <YAxis fontSize={12} />
 <Tooltip 
 labelFormatter={(value) => formatTimestamp(value as string)}
 formatter={(value: number, name: string) => [
 name === 'availability' ? `${value.toFixed(2)}%` :
 name === 'throughput' ? `${value.toFixed(0)}/s` :
 value.toFixed(2),
 name
 ]}
 />
 <Legend />
 <Area
 type="monotone"
 dataKey="availability"
 stackId="1"
 stroke="#10B981"
 fill="#10B981"
 fillOpacity={0.6}
 name="Availability"
 />
 <Area
 type="monotone"
 dataKey="throughput"
 stackId="2"
 stroke="#3B82F6"
 fill="#3B82F6"
 fillOpacity={0.4}
 name="Throughput (scaled)"
 scale="auto"
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Service Performance Table */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
 <div className="p-6 border-b border-gray-200 dark:border-gray-700">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Service Performance Summary
 </h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-50 dark:bg-gray-700">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Service
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Response Time
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Throughput
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Error Rate
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Availability
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Status
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {getPerformanceByService().map((service, _index) => (
 <tr key={service.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
 {service.name}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
 <span className={service.responseTime > 200 ? 'text-red-600' : service.responseTime > 100 ? 'text-yellow-600' : 'text-green-600'}>
 {service.responseTime.toFixed(0)}ms
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
 {service.throughput.toFixed(0)}/s
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
 <span className={service.errorRate > 3 ? 'text-red-600' : service.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'}>
 {service.errorRate.toFixed(2)}%
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
 <span className={service.availability < 99.5 ? 'text-red-600' : service.availability < 99.9 ? 'text-yellow-600' : 'text-green-600'}>
 {service.availability.toFixed(2)}%
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
 service.availability > 99.5 && service.errorRate < 1 && service.responseTime < 100
 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
 : service.availability > 99 && service.errorRate < 3 && service.responseTime < 200
 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
 : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
 }`}>
 {service.availability > 99.5 && service.errorRate < 1 && service.responseTime < 100 ? 'Healthy' :
 service.availability > 99 && service.errorRate < 3 && service.responseTime < 200 ? 'Degraded' : 'Critical'}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 );
}

const MetricCard = ({ 
 title, 
 value, 
 trend, 
 icon, 
 color 
}: { 
 title: string; 
 value: string; 
 trend: 'up' | 'down' | 'neutral'; 
 icon: React.ReactNode; 
 color: 'blue' | 'green' | 'red' | 'purple'; 
}) => {
 const colorClasses = {
 blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
 green: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300',
 red: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300',
 purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300'
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
 >
 <div className="flex items-center justify-between mb-2">
 <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
 {icon}
 </div>
 {trend !== 'neutral' && (
 <div className={`flex items-center ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
 {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
 </div>
 )}
 </div>
 <div>
 <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
 <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
 </div>
 </motion.div>
 );
}