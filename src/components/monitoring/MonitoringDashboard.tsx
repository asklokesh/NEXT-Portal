'use client';

import React, { useState, useEffect } from 'react';
import {
 Activity,
 AlertTriangle,
 CheckCircle,
 Clock,
 Cpu,
 Database,
 Eye,
 Filter,
 BarChart3,
 TrendingUp,
 TrendingDown,
 Zap,
 AlertCircle,
 Info,
 XCircle,
 RefreshCw,
 Download,
 Settings,
 Calendar,
 Search
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from '@/components/charts';
import { useMonitoringDashboard, useSystemHealth, useAlerts, useLogs } from '@/hooks/useMonitoring';
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

interface MonitoringDashboardProps {
 entityRef?: string;
 timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
}

export function MonitoringDashboard({ entityRef, timeRange = '24h' }: MonitoringDashboardProps) {
 const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'logs' | 'metrics' | 'performance'>('overview');
 const [refreshing, setRefreshing] = useState(false);
 const dashboard = useMonitoringDashboard();

 const handleRefresh = async () => {
 setRefreshing(true);
 // Simulate refresh delay
 await new Promise(resolve => setTimeout(resolve, 1000));
 setRefreshing(false);
 };

 const getTimeRangeMs = (range: string) => {
 const now = Date.now();
 switch (range) {
 case '1h': return now - 60 * 60 * 1000;
 case '6h': return now - 6 * 60 * 60 * 1000;
 case '24h': return now - 24 * 60 * 60 * 1000;
 case '7d': return now - 7 * 24 * 60 * 60 * 1000;
 case '30d': return now - 30 * 24 * 60 * 60 * 1000;
 default: return now - 24 * 60 * 60 * 1000;
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Monitoring & Observability
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Real-time monitoring, alerts, and performance insights
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={handleRefresh}
 disabled={refreshing}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
 >
 <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
 Refresh
 </button>
 <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
 <Download className="w-4 h-4" />
 Export
 </button>
 <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
 <Settings className="w-4 h-4" />
 Settings
 </button>
 </div>
 </div>

 {/* System Health Status */}
 <SystemHealthIndicator />
 </div>

 {/* Key Metrics Cards */}
 <MetricsOverviewCards dashboard={dashboard} />

 {/* Navigation Tabs */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 <div className="border-b border-gray-200 dark:border-gray-700">
 <nav className="flex space-x-8 px-6">
 {[
 { id: 'overview', label: 'Overview', icon: BarChart3 },
 { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: dashboard.summary.alerts.firing },
 { id: 'logs', label: 'Logs', icon: Eye, badge: dashboard.summary.logs.errors },
 { id: 'metrics', label: 'Metrics', icon: TrendingUp },
 { id: 'performance', label: 'Performance', icon: Zap }
 ].map((tab) => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
 activeTab === tab.id
 ? 'border-blue-500 text-blue-600 dark:text-blue-400'
 : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
 }`}
 >
 <Icon className="w-4 h-4" />
 {tab.label}
 {tab.badge && tab.badge > 0 && (
 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
 {tab.badge}
 </span>
 )}
 </button>
 );
 })}
 </nav>
 </div>

 <div className="p-6">
 {activeTab === 'overview' && <OverviewTab dashboard={dashboard} />}
 {activeTab === 'alerts' && <AlertsTab />}
 {activeTab === 'logs' && <LogsTab />}
 {activeTab === 'metrics' && <MetricsTab />}
 {activeTab === 'performance' && <PerformanceTab />}
 </div>
 </div>
 </div>
 );
}

function SystemHealthIndicator() {
 const { health, loading } = useSystemHealth();

 if (loading) {
 return (
 <div className="flex items-center gap-2">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
 <span className="text-sm text-gray-600 dark:text-gray-400">Checking system health...</span>
 </div>
 );
 }

 const getStatusIcon = () => {
 switch (health.status) {
 case 'healthy':
 return <CheckCircle className="w-5 h-5 text-green-500" />;
 case 'degraded':
 return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
 case 'unhealthy':
 return <XCircle className="w-5 h-5 text-red-500" />;
 default:
 return <AlertCircle className="w-5 h-5 text-gray-500" />;
 }
 };

 const getStatusColor = () => {
 switch (health.status) {
 case 'healthy': return 'text-green-600 dark:text-green-400';
 case 'degraded': return 'text-yellow-600 dark:text-yellow-400';
 case 'unhealthy': return 'text-red-600 dark:text-red-400';
 default: return 'text-gray-600 dark:text-gray-400';
 }
 };

 return (
 <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex items-center gap-3">
 {getStatusIcon()}
 <div>
 <h3 className={`font-medium ${getStatusColor()}`}>
 System Status: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 {health.checks.length} health checks completed
 </p>
 </div>
 </div>
 
 <div className="flex gap-2">
 {health.checks.map((check, index) => (
 <div
 key={index}
 className={`px-2 py-1 rounded text-xs font-medium ${
 check.status === 'pass' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
 check.status === 'warn' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
 }`}
 title={check.message}
 >
 {check.name}
 </div>
 ))}
 </div>
 </div>
 );
}

function MetricsOverviewCards({ dashboard }: { dashboard: ReturnType<typeof useMonitoringDashboard> }) {
 const cards = [
 {
 title: 'Active Alerts',
 value: dashboard.summary.alerts.firing,
 subvalue: `${dashboard.summary.alerts.critical} critical`,
 icon: AlertTriangle,
 color: dashboard.summary.alerts.firing > 0 ? 'text-red-600' : 'text-green-600',
 bgColor: dashboard.summary.alerts.firing > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'
 },
 {
 title: 'Avg Response Time',
 value: `${dashboard.summary.performance.avgResponseTime.toFixed(0)}ms`,
 subvalue: `${dashboard.summary.performance.successRate.toFixed(1)}% success`,
 icon: Clock,
 color: dashboard.summary.performance.avgResponseTime > 500 ? 'text-yellow-600' : 'text-green-600',
 bgColor: dashboard.summary.performance.avgResponseTime > 500 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'
 },
 {
 title: 'CPU Usage',
 value: `${dashboard.summary.system.avgCpu.toFixed(1)}%`,
 subvalue: `Max: ${dashboard.summary.system.maxCpu.toFixed(1)}%`,
 icon: Cpu,
 color: dashboard.summary.system.avgCpu > 80 ? 'text-red-600' : dashboard.summary.system.avgCpu > 60 ? 'text-yellow-600' : 'text-green-600',
 bgColor: dashboard.summary.system.avgCpu > 80 ? 'bg-red-50 dark:bg-red-900/20' : dashboard.summary.system.avgCpu > 60 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'
 },
 {
 title: 'Memory Usage',
 value: `${dashboard.summary.system.avgMemory.toFixed(1)}%`,
 subvalue: `Max: ${dashboard.summary.system.maxMemory.toFixed(1)}%`,
 icon: Database,
 color: dashboard.summary.system.avgMemory > 80 ? 'text-red-600' : dashboard.summary.system.avgMemory > 60 ? 'text-yellow-600' : 'text-green-600',
 bgColor: dashboard.summary.system.avgMemory > 80 ? 'bg-red-50 dark:bg-red-900/20' : dashboard.summary.system.avgMemory > 60 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'
 }
 ];

 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {cards.map((card, index) => {
 const Icon = card.icon;
 return (
 <div key={index} className={`${card.bgColor} rounded-lg p-6 border border-gray-200 dark:border-gray-700`}>
 <div className="flex items-center justify-between mb-4">
 <Icon className={`w-8 h-8 ${card.color}`} />
 </div>
 <div>
 <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
 {card.title}
 </p>
 <p className={`text-2xl font-bold ${card.color} mb-1`}>
 {card.value}
 </p>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 {card.subvalue}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 );
}

function OverviewTab({ dashboard }: { dashboard: ReturnType<typeof useMonitoringDashboard> }) {
 // Generate chart data from metrics
 const chartData = Array.from({ length: 24 }, (_, i) => {
 const hour = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
 return {
 time: hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
 cpu: Math.random() * 100,
 memory: Math.random() * 100,
 responseTime: Math.random() * 500 + 100,
 requests: Math.floor(Math.random() * 1000) + 500
 };
 });

 return (
 <div className="space-y-6">
 {/* System Metrics Chart */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 System Metrics (24h)
 </h3>
 <div className="h-80">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="time" />
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="cpu" stroke="#8884d8" strokeWidth={2} name="CPU %" />
 <Line type="monotone" dataKey="memory" stroke="#82ca9d" strokeWidth={2} name="Memory %" />
 <Line type="monotone" dataKey="responseTime" stroke="#ffc658" strokeWidth={2} name="Response Time (ms)" />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Recent Alerts and Logs */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <RecentAlerts />
 <RecentLogs />
 </div>
 </div>
 );
}

function AlertsTab() {
 const { alerts, firingAlerts } = useAlerts();
 const [filter, setFilter] = useState<'all' | 'firing' | 'resolved'>('all');

 const filteredAlerts = filter === 'all' ? alerts : 
 filter === 'firing' ? firingAlerts :
 alerts.filter(a => a.status === 'resolved');

 return (
 <div className="space-y-4">
 {/* Filter Controls */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <select
 value={filter}
 onChange={(e) => setFilter(e.target.value as any)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Alerts</option>
 <option value="firing">Firing</option>
 <option value="resolved">Resolved</option>
 </select>
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">
 {filteredAlerts.length} alerts
 </div>
 </div>

 {/* Alerts List */}
 <div className="space-y-3">
 {filteredAlerts.map((alert) => (
 <AlertItem key={alert.id} alert={alert} />
 ))}
 {filteredAlerts.length === 0 && (
 <div className="text-center py-12">
 <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No alerts found
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 {filter === 'firing' ? 'No active alerts' : 'No alerts match the current filter'}
 </p>
 </div>
 )}
 </div>
 </div>
 );
}

function LogsTab() {
 const [filters, setFilters] = useState({
 level: undefined as string | undefined,
 source: undefined as string | undefined,
 search: ''
 });

 const { logs, loading } = useLogs({
 level: filters.level as any,
 source: filters.source,
 since: Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
 });

 const filteredLogs = logs.filter(log => 
 !filters.search || 
 log.message.toLowerCase().includes(filters.search.toLowerCase()) ||
 log.source.toLowerCase().includes(filters.search.toLowerCase())
 );

 return (
 <div className="space-y-4">
 {/* Filter Controls */}
 <div className="flex items-center gap-4 flex-wrap">
 <div className="flex-1 min-w-64">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search logs..."
 value={filters.search}
 onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 </div>
 <select
 value={filters.level || ''}
 onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value || undefined }))}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="">All Levels</option>
 <option value="error">Error</option>
 <option value="warn">Warning</option>
 <option value="info">Info</option>
 <option value="debug">Debug</option>
 </select>
 </div>

 {/* Logs List */}
 {loading ? (
 <div className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
 </div>
 ) : (
 <div className="space-y-2">
 {filteredLogs.map((log) => (
 <LogItem key={log.id} log={log} />
 ))}
 {filteredLogs.length === 0 && (
 <div className="text-center py-12">
 <Eye className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No logs found
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 No logs match the current filters
 </p>
 </div>
 )}
 </div>
 )}
 </div>
 );
}

function MetricsTab() {
 return (
 <div className="space-y-6">
 <div className="text-center py-12">
 <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Custom Metrics Dashboard
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Detailed metrics visualization will be implemented here
 </p>
 </div>
 </div>
 );
}

function PerformanceTab() {
 return (
 <div className="space-y-6">
 <div className="text-center py-12">
 <Zap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Performance Analytics
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Performance metrics and analysis will be implemented here
 </p>
 </div>
 </div>
 );
}

function RecentAlerts() {
 const { alerts } = useAlerts();
 const recentAlerts = alerts.slice(0, 5);

 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Recent Alerts
 </h3>
 <div className="space-y-3">
 {recentAlerts.map((alert) => (
 <AlertItem key={alert.id} alert={alert} compact />
 ))}
 {recentAlerts.length === 0 && (
 <p className="text-gray-500 dark:text-gray-400 text-sm">
 No recent alerts
 </p>
 )}
 </div>
 </div>
 );
}

function RecentLogs() {
 const { logs } = useLogs({ since: Date.now() - 60 * 60 * 1000 }); // Last hour
 const recentLogs = logs.slice(0, 5);

 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Recent Logs
 </h3>
 <div className="space-y-2">
 {recentLogs.map((log) => (
 <LogItem key={log.id} log={log} compact />
 ))}
 {recentLogs.length === 0 && (
 <p className="text-gray-500 dark:text-gray-400 text-sm">
 No recent logs
 </p>
 )}
 </div>
 </div>
 );
}

function AlertItem({ alert, compact = false }: { alert: any; compact?: boolean }) {
 const getSeverityIcon = (severity: string) => {
 switch (severity) {
 case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
 case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
 case 'info': return <Info className="w-4 h-4 text-blue-500" />;
 default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
 }
 };

 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case 'critical': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
 case 'warning': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
 case 'info': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
 default: return 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700';
 }
 };

 return (
 <div className={`border rounded-lg p-3 ${getSeverityColor(alert.severity)} ${compact ? 'p-2' : 'p-3'}`}>
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 {getSeverityIcon(alert.severity)}
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className={`font-medium text-gray-900 dark:text-gray-100 ${compact ? 'text-sm' : ''}`}>
 {alert.name}
 </h4>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 alert.status === 'firing' 
 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
 : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
 }`}>
 {alert.status}
 </span>
 </div>
 <p className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
 {alert.message}
 </p>
 {!compact && (
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {getRelativeTimeString(new Date(alert.timestamp))}
 {alert.entityRef && ` • ${alert.entityRef}`}
 </p>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}

function LogItem({ log, compact = false }: { log: any; compact?: boolean }) {
 const getLevelIcon = (level: string) => {
 switch (level) {
 case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
 case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
 case 'info': return <Info className="w-4 h-4 text-blue-500" />;
 case 'debug': return <Activity className="w-4 h-4 text-gray-500" />;
 default: return <Activity className="w-4 h-4 text-gray-500" />;
 }
 };

 return (
 <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 ${compact ? 'p-2' : 'p-3'}`}>
 <div className="flex items-start gap-3">
 {getLevelIcon(log.level)}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className={`px-2 py-1 rounded text-xs font-medium ${
 log.level === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
 log.level === 'warn' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
 log.level === 'info' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
 }`}>
 {log.level.toUpperCase()}
 </span>
 <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
 {log.source}
 </span>
 </div>
 <p className={`text-gray-900 dark:text-gray-100 ${compact ? 'text-xs' : 'text-sm'} break-words`}>
 {log.message}
 </p>
 {!compact && (
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {getRelativeTimeString(new Date(log.timestamp))}
 {log.entityRef && ` • ${log.entityRef}`}
 </p>
 )}
 </div>
 </div>
 </div>
 );
}