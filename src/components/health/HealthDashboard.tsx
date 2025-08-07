'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

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
 Activity,
 AlertCircle,
 CheckCircle,
 Clock,
 Shield,
 Bell,
 BellOff,
 RefreshCw,
 Filter,
 Search
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { healthMonitor, type ServiceHealth, type HealthAlert } from '@/lib/monitoring/health-monitor';


interface HealthDashboardProps {
 serviceRef?: string; // If provided, show health for specific service
 compact?: boolean;
}

export const HealthDashboard = ({ serviceRef, compact = false }: HealthDashboardProps) => {
 const [serviceHealthData, setServiceHealthData] = useState<ServiceHealth[]>([]);
 const [alerts, setAlerts] = useState<HealthAlert[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<'all' | 'healthy' | 'degraded' | 'unhealthy'>('all');
 const [alertFilter, setAlertFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
 const [searchTerm, setSearchTerm] = useState('');
 const [monitoringEnabled, setMonitoringEnabled] = useState(false);

 useEffect(() => {
 // Initial load
 loadHealthData();
 
 // Set up event listeners
 const handleHealthUpdate = () => loadHealthData();
 const handleAlertCreated = (alert: HealthAlert) => {
 toast.error(`New alert: ${alert.title}`, {
 duration: 5000
 });
 loadHealthData();
 };
 const handleAlertAcknowledged = (alert: HealthAlert) => {
 toast.success(`Alert acknowledged: ${alert.title}`);
 loadHealthData();
 };
 const handleAlertResolved = (alert: HealthAlert) => {
 toast.success(`Alert resolved: ${alert.title}`);
 loadHealthData();
 };

 healthMonitor.on('healthUpdated', handleHealthUpdate);
 healthMonitor.on('alertCreated', handleAlertCreated);
 healthMonitor.on('alertAcknowledged', handleAlertAcknowledged);
 healthMonitor.on('alertResolved', handleAlertResolved);

 // Start monitoring
 if (!healthMonitor.isMonitoring()) {
 healthMonitor.startMonitoring();
 setMonitoringEnabled(true);
 } else {
 setMonitoringEnabled(true);
 }

 return () => {
 healthMonitor.off('healthUpdated', handleHealthUpdate);
 healthMonitor.off('alertCreated', handleAlertCreated);
 healthMonitor.off('alertAcknowledged', handleAlertAcknowledged);
 healthMonitor.off('alertResolved', handleAlertResolved);
 };
 }, []);

 const loadHealthData = () => {
 try {
 if (serviceRef) {
 const health = healthMonitor.getServiceHealth(serviceRef);
 setServiceHealthData(health ? [health] : []);
 setAlerts(health ? health.alerts : []);
 } else {
 setServiceHealthData(healthMonitor.getAllServiceHealth());
 setAlerts(healthMonitor.getActiveAlerts());
 }
 } catch (error) {
 console.error('Failed to load health data:', error);
 toast.error('Failed to load health data');
 } finally {
 setLoading(false);
 }
 };

 const toggleMonitoring = () => {
 if (monitoringEnabled) {
 healthMonitor.stopMonitoring();
 setMonitoringEnabled(false);
 toast.success('Health monitoring stopped');
 } else {
 healthMonitor.startMonitoring();
 setMonitoringEnabled(true);
 toast.success('Health monitoring started');
 }
 };

 const acknowledgeAlert = async (alertId: string) => {
 const success = healthMonitor.acknowledgeAlert(alertId, 'current-user');
 if (success) {
 toast.success('Alert acknowledged');
 } else {
 toast.error('Failed to acknowledge alert');
 }
 };

 const resolveAlert = async (alertId: string) => {
 const success = healthMonitor.resolveAlert(alertId);
 if (success) {
 toast.success('Alert resolved');
 } else {
 toast.error('Failed to resolve alert');
 }
 };

 // Filter services
 const filteredServices = serviceHealthData.filter(service => {
 if (filter !== 'all' && service.overallStatus !== filter) return false;
 if (searchTerm && !service.serviceRef.toLowerCase().includes(searchTerm.toLowerCase())) return false;
 return true;
 });

 // Filter alerts
 const filteredAlerts = alerts.filter(alert => {
 if (alertFilter !== 'all' && alert.status !== alertFilter) return false;
 if (searchTerm && !alert.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
 return true;
 });

 const _getStatusColor = (status: string) => {
 switch (status) {
 case 'healthy': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
 case 'degraded': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
 case 'unhealthy': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
 default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
 };

 const _getStatusIcon = (status: string) => {
 switch (status) {
 case 'healthy': return <CheckCircle className="w-4 h-4" />;
 case 'degraded': return <AlertCircle className="w-4 h-4" />;
 case 'unhealthy': return <AlertCircle className="w-4 h-4" />;
 default: return <Clock className="w-4 h-4" />;
 }
 };

 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case 'critical': return 'text-red-800 bg-red-100 dark:bg-red-900 dark:text-red-300';
 case 'high': return 'text-orange-800 bg-orange-100 dark:bg-orange-900 dark:text-orange-300';
 case 'medium': return 'text-yellow-800 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
 case 'low': return 'text-blue-800 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
 default: return 'text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-48">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 if (compact) {
 return (
 <div className="space-y-4">
 {/* Compact Overview */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
 <div className="flex items-center gap-2">
 <Shield className="w-5 h-5 text-green-600" />
 <div>
 <p className="text-sm text-gray-500">Healthy</p>
 <p className="text-lg font-bold text-green-600">
 {filteredServices.filter(s => s.overallStatus === 'healthy').length}
 </p>
 </div>
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
 <div className="flex items-center gap-2">
 <AlertCircle className="w-5 h-5 text-yellow-600" />
 <div>
 <p className="text-sm text-gray-500">Degraded</p>
 <p className="text-lg font-bold text-yellow-600">
 {filteredServices.filter(s => s.overallStatus === 'degraded').length}
 </p>
 </div>
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
 <div className="flex items-center gap-2">
 <AlertCircle className="w-5 h-5 text-red-600" />
 <div>
 <p className="text-sm text-gray-500">Unhealthy</p>
 <p className="text-lg font-bold text-red-600">
 {filteredServices.filter(s => s.overallStatus === 'unhealthy').length}
 </p>
 </div>
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
 <div className="flex items-center gap-2">
 <Bell className="w-5 h-5 text-orange-600" />
 <div>
 <p className="text-sm text-gray-500">Active Alerts</p>
 <p className="text-lg font-bold text-orange-600">
 {filteredAlerts.filter(a => a.status === 'active').length}
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Recent Alerts */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
 <h3 className="text-lg font-semibold mb-3">Recent Alerts</h3>
 <div className="space-y-2">
 {filteredAlerts.slice(0, 3).map(alert => (
 <div key={alert.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
 <div className="flex items-center gap-2">
 <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
 {alert.severity}
 </span>
 <span className="text-sm text-gray-900 dark:text-gray-100">{alert.title}</span>
 </div>
 <span className="text-xs text-gray-500">
 {getRelativeTimeString(new Date(alert.createdAt))}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Health Monitoring
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Real-time health status and alerts for your services
 </p>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={toggleMonitoring}
 className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${
 monitoringEnabled
 ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
 : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
 }`}
 >
 {monitoringEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
 {monitoringEnabled ? 'Monitoring Active' : 'Start Monitoring'}
 </button>
 
 <button
 onClick={loadHealthData}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Overview Stats */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
 <OverviewCard
 title="Total Services"
 value={serviceHealthData.length}
 icon={<Activity className="w-6 h-6" />}
 color="blue"
 />
 <OverviewCard
 title="Healthy"
 value={serviceHealthData.filter(s => s.overallStatus === 'healthy').length}
 icon={<CheckCircle className="w-6 h-6" />}
 color="green"
 />
 <OverviewCard
 title="Degraded"
 value={serviceHealthData.filter(s => s.overallStatus === 'degraded').length}
 icon={<AlertCircle className="w-6 h-6" />}
 color="yellow"
 />
 <OverviewCard
 title="Unhealthy"
 value={serviceHealthData.filter(s => s.overallStatus === 'unhealthy').length}
 icon={<AlertCircle className="w-6 h-6" />}
 color="red"
 />
 <OverviewCard
 title="Active Alerts"
 value={alerts.filter(a => a.status === 'active').length}
 icon={<Bell className="w-6 h-6" />}
 color="orange"
 />
 </div>

 {/* Filters */}
 <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
 <div className="flex items-center gap-2">
 <Search className="w-4 h-4 text-gray-400" />
 <input
 type="text"
 placeholder="Search services and alerts..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 
 <div className="flex items-center gap-2">
 <Filter className="w-4 h-4 text-gray-400" />
 <select
 value={filter}
 onChange={(e) => setFilter(e.target.value as any)}
 className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Services</option>
 <option value="healthy">Healthy</option>
 <option value="degraded">Degraded</option>
 <option value="unhealthy">Unhealthy</option>
 </select>
 </div>
 
 <div className="flex items-center gap-2">
 <select
 value={alertFilter}
 onChange={(e) => setAlertFilter(e.target.value as any)}
 className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Alerts</option>
 <option value="active">Active</option>
 <option value="acknowledged">Acknowledged</option>
 <option value="resolved">Resolved</option>
 </select>
 </div>
 </div>

 {/* Service Health Grid */}
 <div className="grid gap-6 lg:grid-cols-2">
 {/* Services */}
 <div className="space-y-4">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Service Health ({filteredServices.length})
 </h2>
 
 <div className="space-y-3">
 <AnimatePresence>
 {filteredServices.map(service => (
 <ServiceHealthCard
 key={service.serviceRef}
 service={service}
 />
 ))}
 </AnimatePresence>
 </div>
 </div>

 {/* Alerts */}
 <div className="space-y-4">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Alerts ({filteredAlerts.length})
 </h2>
 
 <div className="space-y-3">
 <AnimatePresence>
 {filteredAlerts.map(alert => (
 <AlertCard
 key={alert.id}
 alert={alert}
 onAcknowledge={() => acknowledgeAlert(alert.id)}
 onResolve={() => resolveAlert(alert.id)}
 />
 ))}
 </AnimatePresence>
 </div>
 </div>
 </div>
 </div>
 );
}

const OverviewCard = ({ 
 title, 
 value, 
 icon, 
 color 
}: { 
 title: string; 
 value: number; 
 icon: React.ReactNode; 
 color: 'blue' | 'green' | 'yellow' | 'red' | 'orange'; 
}) => {
 const colorClasses = {
 blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
 green: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300',
 yellow: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300',
 red: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300',
 orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300'
 };

 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
 {icon}
 </div>
 <div>
 <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
 <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
 </div>
 </div>
 </div>
 );
}

const ServiceHealthCard = ({ service }: { service: ServiceHealth }) => {
 const getStatusColor = (status: string) => {
 switch (status) {
 case 'healthy': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
 case 'degraded': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
 case 'unhealthy': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
 default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'healthy': return <CheckCircle className="w-4 h-4" />;
 case 'degraded': return <AlertCircle className="w-4 h-4" />;
 case 'unhealthy': return <AlertCircle className="w-4 h-4" />;
 default: return <Clock className="w-4 h-4" />;
 }
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
 >
 <div className="flex items-start justify-between mb-3">
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 {service.serviceRef.split('/').pop()}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
 {service.serviceRef}
 </p>
 </div>
 
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.overallStatus)}`}>
 {getStatusIcon(service.overallStatus)}
 {service.overallStatus}
 </span>
 </div>

 {/* Metrics */}
 <div className="grid grid-cols-3 gap-3 mb-3">
 <div className="text-center">
 <p className="text-xs text-gray-500 dark:text-gray-400">Availability</p>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {service.metrics.availability.toFixed(1)}%
 </p>
 </div>
 <div className="text-center">
 <p className="text-xs text-gray-500 dark:text-gray-400">Avg Response</p>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {service.metrics.avgResponseTime.toFixed(0)}ms
 </p>
 </div>
 <div className="text-center">
 <p className="text-xs text-gray-500 dark:text-gray-400">Error Rate</p>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {service.metrics.errorRate.toFixed(1)}%
 </p>
 </div>
 </div>

 {/* Health Checks */}
 <div className="space-y-1">
 {service.checks.slice(0, 3).map(check => (
 <div key={check.id} className="flex items-center justify-between text-xs">
 <span className="text-gray-600 dark:text-gray-400">{check.name}</span>
 <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-xs ${getStatusColor(check.status)}`}>
 {getStatusIcon(check.status)}
 {check.status}
 </span>
 </div>
 ))}
 {service.checks.length > 3 && (
 <p className="text-xs text-gray-500 dark:text-gray-400">
 +{service.checks.length - 3} more checks
 </p>
 )}
 </div>
 </motion.div>
 );
}

const AlertCard = ({ 
 alert, 
 onAcknowledge, 
 onResolve 
}: { 
 alert: HealthAlert; 
 onAcknowledge: () => void; 
 onResolve: () => void; 
}) => {
 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case 'critical': return 'text-red-800 bg-red-100 dark:bg-red-900 dark:text-red-300';
 case 'high': return 'text-orange-800 bg-orange-100 dark:bg-orange-900 dark:text-orange-300';
 case 'medium': return 'text-yellow-800 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
 case 'low': return 'text-blue-800 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
 default: return 'text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'active': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
 case 'acknowledged': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
 case 'resolved': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
 default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
 {alert.severity}
 </span>
 <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
 {alert.status}
 </span>
 </div>
 
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 {alert.title}
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 {alert.description}
 </p>
 
 <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
 <span>{alert.serviceRef.split('/').pop()}</span>
 <span>{getRelativeTimeString(new Date(alert.createdAt))}</span>
 {alert.acknowledgedBy && (
 <span>Ack'd by {alert.acknowledgedBy}</span>
 )}
 </div>
 </div>
 
 <div className="flex items-center gap-1 ml-4">
 {alert.status === 'active' && (
 <>
 <button
 onClick={onAcknowledge}
 className="p-1 text-gray-400 hover:text-yellow-600 rounded"
 title="Acknowledge alert"
 >
 <Clock className="w-4 h-4" />
 </button>
 <button
 onClick={onResolve}
 className="p-1 text-gray-400 hover:text-green-600 rounded"
 title="Resolve alert"
 >
 <CheckCircle className="w-4 h-4" />
 </button>
 </>
 )}
 {alert.status === 'acknowledged' && (
 <button
 onClick={onResolve}
 className="p-1 text-gray-400 hover:text-green-600 rounded"
 title="Resolve alert"
 >
 <CheckCircle className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Tags */}
 {alert.tags && alert.tags.length > 0 && (
 <div className="flex flex-wrap gap-1">
 {alert.tags.map(tag => (
 <span
 key={tag}
 className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 {tag}
 </span>
 ))}
 </div>
 )}
 </motion.div>
 );
}