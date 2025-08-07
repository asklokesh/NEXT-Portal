'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, react-hooks/exhaustive-deps */

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
 X,
 Plus,
 Search,
 BarChart3,
 Activity,
 Clock,
 Users,
 Database,
 Zap,
 GitBranch,
 CheckCircle,
 AlertCircle,
 ExternalLink,
 Download,
 Filter,
 ArrowUpDown,
 TrendingUp,
 TrendingDown
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { backstageClient, type Entity, type ServiceEntity } from '@/lib/backstage/client';
import { healthMonitor, type ServiceHealth } from '@/lib/monitoring/health-monitor';


interface ComparisonMetrics {
 serviceRef: string;
 availability: number;
 responseTime: number;
 errorRate: number;
 throughput: number;
 activeConnections: number;
 lastDeployment?: string;
 deploymentFrequency: number; // deployments per month
 mttr: number; // mean time to recovery in minutes
 changeFailureRate: number; // percentage
}

interface ServiceComparisonProps {
 initialServices?: string[];
 onClose?: () => void;
 embedded?: boolean;
}

export const ServiceComparison = ({ 
 initialServices = [], 
 onClose,
 embedded = false 
}: ServiceComparisonProps) => {
 const [selectedServices, setSelectedServices] = useState<ServiceEntity[]>([]);
 const [availableServices, setAvailableServices] = useState<ServiceEntity[]>([]);
 const [serviceHealth, setServiceHealth] = useState<Map<string, ServiceHealth>>(new Map());
 const [comparisonMetrics, setComparisonMetrics] = useState<Map<string, ComparisonMetrics>>(new Map());
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [showServiceSelector, setShowServiceSelector] = useState(false);
 const [sortBy, setSortBy] = useState<keyof ComparisonMetrics>('availability');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

 useEffect(() => {
 loadAvailableServices();
 loadInitialServices();
 }, []);

 useEffect(() => {
 if (selectedServices.length > 0) {
 loadComparisonData();
 }
 }, [selectedServices]);

 const loadAvailableServices = async () => {
 try {
 const entities = await backstageClient.getCatalogEntities({
 kinds: ['Component'],
 types: ['service']
 });
 setAvailableServices(entities as ServiceEntity[]);
 } catch (error) {
 console.error('Failed to load services:', error);
 // Use demo data
 setAvailableServices(getDemoServices());
 }
 };

 const loadInitialServices = async () => {
 if (initialServices.length === 0) return;
 
 try {
 const services = await Promise.all(
 initialServices.map(ref => backstageClient.getEntityByRef(ref))
 );
 setSelectedServices(services as ServiceEntity[]);
 } catch (error) {
 console.error('Failed to load initial services:', error);
 } finally {
 setLoading(false);
 }
 };

 const loadComparisonData = async () => {
 const healthData = new Map<string, ServiceHealth>();
 const metricsData = new Map<string, ComparisonMetrics>();

 for (const service of selectedServices) {
 const serviceRef = `${service.kind}:${service.metadata.namespace}/${service.metadata.name}`;
 
 // Load health data
 const health = healthMonitor.getServiceHealth(serviceRef);
 if (health) {
 healthData.set(serviceRef, health);
 }

 // Generate comparison metrics (in real app, this would come from monitoring systems)
 const metrics: ComparisonMetrics = {
 serviceRef,
 availability: health?.metrics.availability || 99.5 + Math.random() * 0.5,
 responseTime: health?.metrics.avgResponseTime || Math.random() * 200 + 50,
 errorRate: health?.metrics.errorRate || Math.random() * 2,
 throughput: Math.random() * 1000 + 100,
 activeConnections: Math.floor(Math.random() * 500 + 50),
 lastDeployment: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
 deploymentFrequency: Math.random() * 10 + 1,
 mttr: Math.random() * 60 + 10,
 changeFailureRate: Math.random() * 5
 };
 
 metricsData.set(serviceRef, metrics);
 }

 setServiceHealth(healthData);
 setComparisonMetrics(metricsData);
 };

 const getDemoServices = (): ServiceEntity[] => [
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'user-service',
 namespace: 'default',
 title: 'User Service',
 description: 'Service for managing user accounts and authentication'
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'platform-team',
 dependsOn: ['auth-service', 'user-database'],
 providesApis: ['user-api']
 }
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'order-service',
 namespace: 'default',
 title: 'Order Service',
 description: 'Service for managing customer orders'
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'commerce-team',
 dependsOn: ['payment-service', 'inventory-service'],
 providesApis: ['order-api']
 }
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'payment-service',
 namespace: 'default',
 title: 'Payment Service',
 description: 'Service for processing payments'
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'payments-team',
 dependsOn: ['payment-gateway'],
 providesApis: ['payment-api']
 }
 }
 ];

 const addService = (service: ServiceEntity) => {
 if (selectedServices.find(s => s.metadata.name === service.metadata.name)) {
 toast.error('Service already selected');
 return;
 }
 
 if (selectedServices.length >= 5) {
 toast.error('Maximum 5 services can be compared');
 return;
 }

 setSelectedServices(prev => [...prev, service]);
 setShowServiceSelector(false);
 toast.success(`Added ${service.metadata.title || service.metadata.name} to comparison`);
 };

 const removeService = (serviceName: string) => {
 setSelectedServices(prev => prev.filter(s => s.metadata.name !== serviceName));
 toast.success('Service removed from comparison');
 };

 const filteredAvailableServices = availableServices.filter(service =>
 !selectedServices.find(s => s.metadata.name === service.metadata.name) &&
 (service.metadata.title || service.metadata.name).toLowerCase().includes(searchTerm.toLowerCase())
 );

 const sortedServices = [...selectedServices].sort((a, b) => {
 const aRef = `${a.kind}:${a.metadata.namespace}/${a.metadata.name}`;
 const bRef = `${b.kind}:${b.metadata.namespace}/${b.metadata.name}`;
 const aMetrics = comparisonMetrics.get(aRef);
 const bMetrics = comparisonMetrics.get(bRef);
 
 if (!aMetrics || !bMetrics) return 0;
 
 const aValue = aMetrics[sortBy];
 const bValue = bMetrics[sortBy];
 
 if (typeof aValue === 'number' && typeof bValue === 'number') {
 return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
 }
 
 return 0;
 });

 const getMetricColor = (value: number, metric: keyof ComparisonMetrics) => {
 switch (metric) {
 case 'availability':
 return value >= 99.9 ? 'text-green-600' : value >= 99.5 ? 'text-yellow-600' : 'text-red-600';
 case 'responseTime':
 return value <= 100 ? 'text-green-600' : value <= 300 ? 'text-yellow-600' : 'text-red-600';
 case 'errorRate':
 return value <= 1 ? 'text-green-600' : value <= 3 ? 'text-yellow-600' : 'text-red-600';
 case 'changeFailureRate':
 return value <= 2 ? 'text-green-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600';
 case 'mttr':
 return value <= 30 ? 'text-green-600' : value <= 60 ? 'text-yellow-600' : 'text-red-600';
 default:
 return 'text-gray-900 dark:text-gray-100';
 }
 };

 const formatMetricValue = (value: number | string | undefined, metric: keyof ComparisonMetrics) => {
 if (value === undefined) return 'N/A';
 
 switch (metric) {
 case 'availability':
 return `${(value as number).toFixed(2)}%`;
 case 'responseTime':
 return `${Math.round(value as number)}ms`;
 case 'errorRate':
 case 'changeFailureRate':
 return `${(value as number).toFixed(2)}%`;
 case 'throughput':
 return `${Math.round(value as number)}/s`;
 case 'deploymentFrequency':
 return `${(value as number).toFixed(1)}/month`;
 case 'mttr':
 return `${Math.round(value as number)}min`;
 case 'lastDeployment':
 return value ? getRelativeTimeString(new Date(value as string)) : 'Unknown';
 default:
 return String(value);
 }
 };

 const exportComparison = () => {
 const data = selectedServices.map(service => {
 const serviceRef = `${service.kind}:${service.metadata.namespace}/${service.metadata.name}`;
 const metrics = comparisonMetrics.get(serviceRef);
 const health = serviceHealth.get(serviceRef);
 
 return {
 name: service.metadata.title || service.metadata.name,
 description: service.metadata.description,
 owner: service.spec.owner,
 lifecycle: service.spec.lifecycle,
 ...metrics,
 overallHealth: health?.overallStatus
 };
 });

 const csvContent = [
 Object.keys(data[0] || {}).join(','),
 ...data.map(row => Object.values(row).join(','))
 ].join('\n');

 const blob = new Blob([csvContent], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `service-comparison-${new Date().toISOString().split('T')[0]}.csv`;
 link.click();
 URL.revokeObjectURL(url);
 
 toast.success('Comparison exported successfully');
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 const containerClass = embedded 
 ? "space-y-6" 
 : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50";

 const contentClass = embedded
 ? ""
 : "bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto";

 return (
 <div className={containerClass}>
 <div className={contentClass}>
 {!embedded && (
 <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
 <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Service Comparison
 </h2>
 <button
 onClick={onClose}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 )}

 <div className={embedded ? "" : "p-6 space-y-6"}>
 {/* Controls */}
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <button
 onClick={() => setShowServiceSelector(true)}
 disabled={selectedServices.length >= 5}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Plus className="w-4 h-4" />
 Add Service
 </button>
 
 <div className="text-sm text-gray-500 dark:text-gray-400">
 {selectedServices.length}/5 services selected
 </div>
 </div>

 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <ArrowUpDown className="w-4 h-4 text-gray-400" />
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as keyof ComparisonMetrics)}
 className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="availability">Availability</option>
 <option value="responseTime">Response Time</option>
 <option value="errorRate">Error Rate</option>
 <option value="throughput">Throughput</option>
 <option value="deploymentFrequency">Deploy Frequency</option>
 <option value="mttr">MTTR</option>
 <option value="changeFailureRate">Change Failure Rate</option>
 </select>
 
 <button
 onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
 className="p-1 text-gray-400 hover:text-gray-600 rounded"
 >
 {sortDirection === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
 </button>
 </div>

 <button
 onClick={exportComparison}
 disabled={selectedServices.length === 0}
 className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Download className="w-4 h-4" />
 Export
 </button>
 </div>
 </div>

 {/* Service Selector Modal */}
 <AnimatePresence>
 {showServiceSelector && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
 >
 <motion.div
 initial={{ scale: 0.9, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.9, opacity: 0 }}
 className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto"
 >
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Select Service
 </h3>
 <button
 onClick={() => setShowServiceSelector(false)}
 className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search services..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 </div>
 
 <div className="p-4 space-y-2">
 {filteredAvailableServices.map(service => (
 <button
 key={service.metadata.name}
 onClick={() => addService(service)}
 className="w-full p-3 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
 >
 <div className="font-medium text-gray-900 dark:text-gray-100">
 {service.metadata.title || service.metadata.name}
 </div>
 <div className="text-sm text-gray-500 dark:text-gray-400">
 {service.metadata.description}
 </div>
 </button>
 ))}
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Comparison Table */}
 {selectedServices.length > 0 ? (
 <div className="overflow-x-auto">
 <table className="w-full border border-gray-200 dark:border-gray-700 rounded-lg">
 <thead className="bg-gray-50 dark:bg-gray-800">
 <tr>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 Service
 </th>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 Availability
 </th>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 Response Time
 </th>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 Error Rate
 </th>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 Throughput
 </th>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 Deploy Freq
 </th>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 MTTR
 </th>
 <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
 Actions
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {sortedServices.map(service => {
 const serviceRef = `${service.kind}:${service.metadata.namespace}/${service.metadata.name}`;
 const metrics = comparisonMetrics.get(serviceRef);
 const health = serviceHealth.get(serviceRef);
 
 return (
 <tr key={service.metadata.name} className="bg-white dark:bg-gray-900">
 <td className="px-4 py-3">
 <div>
 <div className="flex items-center gap-2">
 <div className="font-medium text-gray-900 dark:text-gray-100">
 {service.metadata.title || service.metadata.name}
 </div>
 <div className={`w-2 h-2 rounded-full ${
 health?.overallStatus === 'healthy' ? 'bg-green-500' :
 health?.overallStatus === 'degraded' ? 'bg-yellow-500' :
 health?.overallStatus === 'unhealthy' ? 'bg-red-500' :
 'bg-gray-500'
 }`} />
 </div>
 <div className="text-sm text-gray-500 dark:text-gray-400">
 {service.spec.owner}
 </div>
 </div>
 </td>
 <td className={`px-4 py-3 font-medium ${getMetricColor(metrics?.availability || 0, 'availability')}`}>
 {formatMetricValue(metrics?.availability, 'availability')}
 </td>
 <td className={`px-4 py-3 font-medium ${getMetricColor(metrics?.responseTime || 0, 'responseTime')}`}>
 {formatMetricValue(metrics?.responseTime, 'responseTime')}
 </td>
 <td className={`px-4 py-3 font-medium ${getMetricColor(metrics?.errorRate || 0, 'errorRate')}`}>
 {formatMetricValue(metrics?.errorRate, 'errorRate')}
 </td>
 <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
 {formatMetricValue(metrics?.throughput, 'throughput')}
 </td>
 <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
 {formatMetricValue(metrics?.deploymentFrequency, 'deploymentFrequency')}
 </td>
 <td className={`px-4 py-3 font-medium ${getMetricColor(metrics?.mttr || 0, 'mttr')}`}>
 {formatMetricValue(metrics?.mttr, 'mttr')}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <button
 onClick={() => window.open(`/catalog/${service.metadata.namespace}/${service.kind}/${service.metadata.name}`, '_blank')}
 className="p-1 text-gray-400 hover:text-blue-600 rounded"
 title="View Details"
 >
 <ExternalLink className="w-4 h-4" />
 </button>
 <button
 onClick={() => removeService(service.metadata.name)}
 className="p-1 text-gray-400 hover:text-red-600 rounded"
 title="Remove from comparison"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="text-center py-12">
 <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No services selected
 </h3>
 <p className="text-gray-500 dark:text-gray-400 mb-6">
 Add services to start comparing their metrics and performance.
 </p>
 <button
 onClick={() => setShowServiceSelector(true)}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 <Plus className="w-4 h-4" />
 Add Service
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}