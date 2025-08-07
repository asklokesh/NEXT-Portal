'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, react-hooks/exhaustive-deps */

// Removed direct import of costAggregator to avoid Node.js dependencies in client
// Using API routes instead

interface AggregatedCostData {
 serviceId: string;
 serviceName: string;
 totalCost: number;
 currency: string;
 breakdown: {
 aws?: number;
 azure?: number;
 gcp?: number;
 };
 trend: {
 current: number;
 previous: number;
 change: number;
 changePercent: number;
 };
 recommendations: Array<{
 type: string;
 description: string;
 estimatedSavings: number;
 effort: string;
 impact: string;
 }>;
}

interface CostSummary {
 totalCost: number;
 currency: string;
 periodStart: Date;
 periodEnd: Date;
 breakdown: {
 aws: number;
 azure: number;
 gcp: number;
 };
 topServices: Array<{
 serviceId: string;
 serviceName: string;
 cost: number;
 percentage: number;
 }>;
 trends: {
 daily: Array<{
 date: Date;
 totalCost: number;
 aws: number;
 azure: number;
 gcp: number;
 }>;
 monthly: Array<{
 month: string;
 totalCost: number;
 aws: number;
 azure: number;
 gcp: number;
 }>;
 };
}

// Removed date-fns import - using native JavaScript date formatting instead
// Note: startOfMonth, endOfMonth, subMonths functionality replaced with native JS
import { motion, AnimatePresence } from 'framer-motion';
import {
 DollarSign,
 TrendingUp,
 TrendingDown,
 AlertTriangle,
 BarChart3,
 PieChart,
 Calendar,
 Download,
 Filter,
 Settings,
 Info,
 ArrowUp,
 ArrowDown,
 Zap,
 Database,
 Server,
 Cloud,
 Users,
 ChevronRight,
 ChevronDown,
 Check,
 X
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
 LineChart,
 Line,
 AreaChart,
 Area,
 BarChart,
 Bar,
 PieChart as RePieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer
} from '@/components/charts';

interface ServiceCost {
 serviceId: string;
 serviceName: string;
 type: 'compute' | 'storage' | 'network' | 'database' | 'other';
 owner: string;
 currentMonth: number;
 previousMonth: number;
 change: number;
 changePercent: number;
 breakdown: {
 aws: number;
 azure: number;
 gcp: number;
 };
 tags: string[];
 environment: 'production' | 'staging' | 'development';
 recommendations?: CostRecommendation[];
}

interface CostRecommendation {
 id: string;
 type: 'optimization' | 'rightsize' | 'shutdown' | 'migrate';
 description: string;
 estimatedSavings: number;
 effort: 'low' | 'medium' | 'high';
 impact: 'low' | 'medium' | 'high';
 status: 'pending' | 'applied' | 'dismissed';
}

interface CostTrend {
 month: string;
 total: number;
 compute: number;
 storage: number;
 network: number;
 database: number;
 other: number;
}

interface ServiceCostTrackerProps {
 serviceId?: string;
 teamFilter?: string;
 embedded?: boolean;
}

export const ServiceCostTracker = ({ 
 serviceId, 
 teamFilter,
 embedded = false 
}: ServiceCostTrackerProps) => {
 const [services, setServices] = useState<ServiceCost[]>([]);
 const [trends, setTrends] = useState<CostTrend[]>([]);
 const [selectedService, setSelectedService] = useState<ServiceCost | null>(null);
 const [loading, setLoading] = useState(true);
 const [viewMode, setViewMode] = useState<'table' | 'trends' | 'breakdown'>('table');
 const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '12m'>('3m');
 const [sortBy, setSortBy] = useState<'cost' | 'change' | 'name'>('cost');
 const [filterBy, setFilterBy] = useState({
 environment: 'all',
 type: 'all',
 threshold: 0
 });
 const [showRecommendations, setShowRecommendations] = useState(true);

 useEffect(() => {
 loadCostData();
 }, [serviceId, teamFilter, timeRange]);

 const loadCostData = async () => {
 try {
 setLoading(true);
 
 // Calculate date range based on timeRange
 const endDate = new Date();
 const startDate = new Date();
 
 switch (timeRange) {
 case '1m':
 startDate.setMonth(endDate.getMonth() - 1);
 break;
 case '3m':
 startDate.setMonth(endDate.getMonth() - 3);
 break;
 case '6m':
 startDate.setMonth(endDate.getMonth() - 6);
 break;
 case '12m':
 startDate.setFullYear(endDate.getFullYear() - 1);
 break;
 }

 // Get real cost data from API
 const serviceIds = serviceId ? [serviceId] : undefined;
 const [aggregatedCosts, costSummary] = await Promise.all([
 fetchCostData(startDate, endDate, serviceIds),
 fetchCostSummary(startDate, endDate)
 ]);
 
 // Convert aggregated data to ServiceCost format
 const convertedServices: ServiceCost[] = aggregatedCosts.map(cost => ({
 serviceId: cost.serviceId,
 serviceName: cost.serviceName,
 type: inferServiceType(cost.serviceName),
 owner: 'unknown', // Would need to get from service metadata
 currentMonth: cost.totalCost,
 previousMonth: cost.trend.previous,
 change: cost.trend.change,
 changePercent: cost.trend.changePercent,
 breakdown: cost.breakdown,
 tags: [], // Would extract from service metadata
 environment: 'production', // Would get from service metadata
 recommendations: cost.recommendations
 }));
 
 // Convert cost summary trends to CostTrend format
 const convertedTrends: CostTrend[] = costSummary.trends.monthly.map(trend => ({
 month: trend.month,
 total: trend.totalCost,
 compute: trend.aws + trend.azure + trend.gcp, // Simplified mapping
 storage: trend.totalCost * 0.2, // Estimated breakdown
 network: trend.totalCost * 0.1,
 database: trend.totalCost * 0.15,
 other: trend.totalCost * 0.05
 }));
 
 setServices(convertedServices);
 setTrends(convertedTrends);
 
 if (serviceId && convertedServices.length > 0) {
 setSelectedService(convertedServices[0]);
 }
 } catch (error) {
 console.error('Failed to load cost data:', error);
 toast.error('Failed to load cost data');
 
 // Fallback to mock data if real data fails
 const mockData = generateMockCostData(serviceId, teamFilter);
 setServices(mockData.services);
 setTrends(mockData.trends);
 } finally {
 setLoading(false);
 }
 };

 const fetchCostData = async (startDate: Date, endDate: Date, serviceIds?: string[]): Promise<AggregatedCostData[]> => {
 const params = new URLSearchParams({
 startDate: startDate.toISOString(),
 endDate: endDate.toISOString(),
 type: 'aggregated',
 });
 
 if (serviceIds) {
 params.append('serviceIds', serviceIds.join(','));
 }
 
 const response = await fetch(`/api/costs?${params.toString()}`);
 if (!response.ok) {
 throw new Error('Failed to fetch cost data');
 }
 
 return response.json();
 };

 const fetchCostSummary = async (startDate: Date, endDate: Date): Promise<CostSummary> => {
 const params = new URLSearchParams({
 startDate: startDate.toISOString(),
 endDate: endDate.toISOString(),
 type: 'summary',
 });
 
 const response = await fetch(`/api/costs?${params.toString()}`);
 if (!response.ok) {
 throw new Error('Failed to fetch cost summary');
 }
 
 return response.json();
 };

 const syncCosts = async () => {
 const endDate = new Date();
 const startDate = new Date();
 startDate.setMonth(endDate.getMonth() - 3); // Last 3 months
 
 try {
 setLoading(true);
 const response = await fetch('/api/costs', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 startDate: startDate.toISOString(),
 endDate: endDate.toISOString(),
 }),
 });
 
 if (!response.ok) {
 throw new Error('Failed to sync costs');
 }
 
 toast.success('Cost data synchronized successfully');
 await loadCostData(); // Reload data after sync
 } catch (error) {
 console.error('Failed to sync costs:', error);
 toast.error('Failed to sync cost data');
 } finally {
 setLoading(false);
 }
 };

 const inferServiceType = (serviceName: string): 'compute' | 'storage' | 'network' | 'database' | 'other' => {
 const name = serviceName.toLowerCase();
 if (name.includes('compute') || name.includes('server') || name.includes('instance')) return 'compute';
 if (name.includes('storage') || name.includes('s3') || name.includes('blob')) return 'storage';
 if (name.includes('network') || name.includes('cdn') || name.includes('load')) return 'network';
 if (name.includes('database') || name.includes('sql') || name.includes('db')) return 'database';
 return 'other';
 };

 const generateMockCostData = (serviceFilter?: string, teamFilter?: string) => {
 const services: ServiceCost[] = [
 {
 serviceId: serviceFilter || 'user-service',
 serviceName: 'User Service',
 type: 'compute',
 owner: 'platform-team',
 currentMonth: 4523.45,
 previousMonth: 3892.12,
 change: 631.33,
 changePercent: 16.2,
 breakdown: {
 aws: 2845.23,
 azure: 1567.89,
 gcp: 110.33
 },
 tags: ['critical', 'production'],
 environment: 'production',
 recommendations: [
 {
 id: '1',
 type: 'rightsize',
 description: 'Reduce instance size from m5.2xlarge to m5.xlarge',
 estimatedSavings: 450,
 effort: 'low',
 impact: 'low',
 status: 'pending'
 },
 {
 id: '2',
 type: 'optimization',
 description: 'Enable auto-scaling for off-peak hours',
 estimatedSavings: 280,
 effort: 'medium',
 impact: 'medium',
 status: 'pending'
 }
 ]
 },
 {
 serviceId: 'auth-service',
 serviceName: 'Authentication Service',
 type: 'compute',
 owner: 'security-team',
 currentMonth: 3245.67,
 previousMonth: 3412.89,
 change: -167.22,
 changePercent: -4.9,
 breakdown: {
 aws: 2123.45,
 azure: 834.56,
 gcp: 287.66
 },
 tags: ['critical', 'production'],
 environment: 'production'
 },
 {
 serviceId: 'analytics-service',
 serviceName: 'Analytics Service',
 type: 'database',
 owner: 'data-team',
 currentMonth: 8934.23,
 previousMonth: 7234.56,
 change: 1699.67,
 changePercent: 23.5,
 breakdown: {
 aws: 4234.56,
 azure: 3345.67,
 gcp: 1354.00
 },
 tags: ['data', 'production'],
 environment: 'production',
 recommendations: [
 {
 id: '3',
 type: 'migrate',
 description: 'Move cold data to cheaper storage tier',
 estimatedSavings: 1200,
 effort: 'high',
 impact: 'high',
 status: 'pending'
 }
 ]
 },
 {
 serviceId: 'frontend-app',
 serviceName: 'Frontend Application',
 type: 'network',
 owner: 'frontend-team',
 currentMonth: 1567.89,
 previousMonth: 1234.56,
 change: 333.33,
 changePercent: 27.0,
 breakdown: {
 aws: 1045.67,
 azure: 423.45,
 gcp: 98.77
 },
 tags: ['frontend', 'production'],
 environment: 'production'
 },
 {
 serviceId: 'staging-cluster',
 serviceName: 'Staging Environment',
 type: 'compute',
 owner: 'platform-team',
 currentMonth: 2345.67,
 previousMonth: 2456.78,
 change: -111.11,
 changePercent: -4.5,
 breakdown: {
 aws: 1567.89,
 azure: 634.56,
 gcp: 143.22
 },
 tags: ['staging'],
 environment: 'staging',
 recommendations: [
 {
 id: '4',
 type: 'shutdown',
 description: 'Schedule shutdown during weekends',
 estimatedSavings: 400,
 effort: 'low',
 impact: 'low',
 status: 'applied'
 }
 ]
 }
 ];

 // Generate trend data
 const months = [];
 for (let i = 0; i < parseInt(timeRange); i++) {
 const date = new Date();
 date.setMonth(date.getMonth() - i);
 months.unshift(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
 }

 const trends: CostTrend[] = months.map((month, index) => ({
 month,
 total: 15000 + Math.random() * 5000 + (index * 200),
 compute: 8000 + Math.random() * 2000 + (index * 100),
 storage: 3000 + Math.random() * 1000 + (index * 50),
 network: 2000 + Math.random() * 500 + (index * 30),
 database: 1500 + Math.random() * 500 + (index * 20),
 other: 500 + Math.random() * 100
 }));

 // Apply filters
 let filteredServices = services;
 
 if (serviceFilter) {
 filteredServices = filteredServices.filter(s => s.serviceId === serviceFilter);
 }
 
 if (teamFilter) {
 filteredServices = filteredServices.filter(s => s.owner === teamFilter);
 }

 return { services: filteredServices, trends };
 };

 const getTotalCost = () => {
 return services.reduce((sum, service) => sum + service.currentMonth, 0);
 };

 const getTotalChange = () => {
 return services.reduce((sum, service) => sum + service.change, 0);
 };

 const getChangeColor = (change: number) => {
 if (change > 0) return 'text-red-600';
 if (change < 0) return 'text-green-600';
 return 'text-gray-600';
 };

 const getChangeIcon = (change: number) => {
 if (change > 0) return <ArrowUp className="w-4 h-4" />;
 if (change < 0) return <ArrowDown className="w-4 h-4" />;
 return null;
 };

 const applyRecommendation = (serviceId: string, recommendationId: string) => {
 setServices(services.map(service => {
 if (service.serviceId === serviceId) {
 return {
 ...service,
 recommendations: service.recommendations?.map(rec => 
 rec.id === recommendationId ? { ...rec, status: 'applied' } : rec
 )
 };
 }
 return service;
 }));
 toast.success('Recommendation applied successfully');
 };

 const dismissRecommendation = (serviceId: string, recommendationId: string) => {
 setServices(services.map(service => {
 if (service.serviceId === serviceId) {
 return {
 ...service,
 recommendations: service.recommendations?.map(rec => 
 rec.id === recommendationId ? { ...rec, status: 'dismissed' } : rec
 )
 };
 }
 return service;
 }));
 toast.info('Recommendation dismissed');
 };

 const exportCostReport = () => {
 // Generate CSV report
 const csv = [
 ['Service', 'Owner', 'Environment', 'Current Month', 'Previous Month', 'Change', 'Change %'],
 ...services.map(s => [
 s.serviceName,
 s.owner,
 s.environment,
 s.currentMonth.toFixed(2),
 s.previousMonth.toFixed(2),
 s.change.toFixed(2),
 `${s.changePercent.toFixed(1)}%`
 ])
 ].map(row => row.join(',')).join('\n');

 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `cost-report-${new Date().toISOString().split('T')[0]}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 
 toast.success('Cost report exported');
 };

 const filteredServices = services.filter(service => {
 if (filterBy.environment !== 'all' && service.environment !== filterBy.environment) return false;
 if (filterBy.type !== 'all' && service.type !== filterBy.type) return false;
 if (service.currentMonth < filterBy.threshold) return false;
 return true;
 });

 const sortedServices = [...filteredServices].sort((a, b) => {
 switch (sortBy) {
 case 'cost':
 return b.currentMonth - a.currentMonth;
 case 'change':
 return Math.abs(b.change) - Math.abs(a.change);
 case 'name':
 return a.serviceName.localeCompare(b.serviceName);
 default:
 return 0;
 }
 });

 const pieData = Object.entries(
 services.reduce((acc, service) => {
 acc['AWS'] = (acc['AWS'] || 0) + (service.breakdown.aws || 0);
 acc['Azure'] = (acc['Azure'] || 0) + (service.breakdown.azure || 0);
 acc['GCP'] = (acc['GCP'] || 0) + (service.breakdown.gcp || 0);
 return acc;
 }, {} as Record<string, number>)
 ).map(([provider, value]) => ({ name: provider, value })).filter(({ value }) => value > 0);

 const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 const containerClass = embedded 
 ? "space-y-4" 
 : "min-h-screen bg-gray-50 dark:bg-gray-900";

 return (
 <div className={containerClass}>
 {!embedded && (
 <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Service Cost Tracking
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Monitor and optimize cloud costs across your services
 </p>
 </div>
 
 <div className="flex items-center gap-3">
 <select
 value={timeRange}
 onChange={(e) => setTimeRange(e.target.value as any)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="1m">Last Month</option>
 <option value="3m">Last 3 Months</option>
 <option value="6m">Last 6 Months</option>
 <option value="12m">Last Year</option>
 </select>
 
 <button
 onClick={syncCosts}
 disabled={loading}
 className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-800 disabled:opacity-50"
 >
 <Database className="w-4 h-4" />
 {loading ? 'Syncing...' : 'Sync Costs'}
 </button>
 
 <button
 onClick={exportCostReport}
 className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
 >
 <Download className="w-4 h-4" />
 Export
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Summary Cards */}
 <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${embedded ? '' : 'p-6'}`}>
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 ${getTotalCost().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </p>
 </div>
 <DollarSign className="w-8 h-8 text-blue-600" />
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Month-over-Month</p>
 <div className={`flex items-center gap-1 text-2xl font-bold ${getChangeColor(getTotalChange())}`}>
 {getChangeIcon(getTotalChange())}
 <span>
 {getTotalChange() > 0 ? '+' : ''}
 {((getTotalChange() / (getTotalCost() - getTotalChange())) * 100).toFixed(1)}%
 </span>
 </div>
 </div>
 {getTotalChange() > 0 ? (
 <TrendingUp className="w-8 h-8 text-red-600" />
 ) : (
 <TrendingDown className="w-8 h-8 text-green-600" />
 )}
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Services Tracked</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {services.length}
 </p>
 </div>
 <Server className="w-8 h-8 text-purple-600" />
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Potential Savings</p>
 <p className="text-2xl font-bold text-green-600">
 ${services.reduce((sum, s) => 
 sum + (s.recommendations?.filter(r => r.status === 'pending')
 .reduce((recSum, r) => recSum + r.estimatedSavings, 0) || 0), 0
 ).toLocaleString('en-US')}
 </p>
 </div>
 <Zap className="w-8 h-8 text-green-600" />
 </div>
 </div>
 </div>

 {/* View Mode Tabs */}
 <div className={`${embedded ? '' : 'px-6'}`}>
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1 inline-flex">
 <button
 onClick={() => setViewMode('table')}
 className={`px-4 py-2 text-sm rounded ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Table View
 </button>
 <button
 onClick={() => setViewMode('trends')}
 className={`px-4 py-2 text-sm rounded ${viewMode === 'trends' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Trends
 </button>
 <button
 onClick={() => setViewMode('breakdown')}
 className={`px-4 py-2 text-sm rounded ${viewMode === 'breakdown' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Breakdown
 </button>
 </div>
 </div>

 {/* Main Content */}
 <div className={`${embedded ? '' : 'p-6'}`}>
 {viewMode === 'table' && (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 {/* Filters */}
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-4">
 <select
 value={filterBy.environment}
 onChange={(e) => setFilterBy({ ...filterBy, environment: e.target.value })}
 className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
 >
 <option value="all">All Environments</option>
 <option value="production">Production</option>
 <option value="staging">Staging</option>
 <option value="development">Development</option>
 </select>
 
 <select
 value={filterBy.type}
 onChange={(e) => setFilterBy({ ...filterBy, type: e.target.value })}
 className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
 >
 <option value="all">All Types</option>
 <option value="compute">Compute</option>
 <option value="storage">Storage</option>
 <option value="network">Network</option>
 <option value="database">Database</option>
 </select>
 
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as any)}
 className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
 >
 <option value="cost">Sort by Cost</option>
 <option value="change">Sort by Change</option>
 <option value="name">Sort by Name</option>
 </select>
 
 <label className="flex items-center gap-2 text-sm">
 <input
 type="checkbox"
 checked={showRecommendations}
 onChange={(e) => setShowRecommendations(e.target.checked)}
 className="rounded"
 />
 Show Recommendations
 </label>
 </div>
 </div>
 
 {/* Service List */}
 <div className="divide-y divide-gray-200 dark:divide-gray-700">
 {sortedServices.map(service => (
 <div key={service.serviceId} className="p-4">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="font-semibold text-gray-900 dark:text-gray-100">
 {service.serviceName}
 </h3>
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
 ${service.environment === 'production' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
 service.environment === 'staging' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' :
 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
 {service.environment}
 </span>
 {service.tags.map(tag => (
 <span key={tag} className="text-xs text-gray-500 dark:text-gray-400">
 #{tag}
 </span>
 ))}
 </div>
 
 <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
 <span>Owner: {service.owner}</span>
 <span>Type: {service.type}</span>
 </div>
 
 {/* Cost Breakdown */}
 <div className="mt-3 grid grid-cols-6 gap-4 text-xs">
 {Object.entries(service.breakdown).map(([category, cost]) => (
 <div key={category}>
 <div className="text-gray-500 dark:text-gray-400 capitalize">{category}</div>
 <div className="font-medium text-gray-900 dark:text-gray-100">
 ${cost.toFixed(0)}
 </div>
 </div>
 ))}
 </div>
 </div>
 
 <div className="text-right ml-6">
 <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 ${service.currentMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </div>
 <div className={`flex items-center justify-end gap-1 text-sm ${getChangeColor(service.change)}`}>
 {getChangeIcon(service.change)}
 <span>
 {service.change > 0 ? '+' : ''}${Math.abs(service.change).toFixed(2)}
 </span>
 <span>({service.changePercent > 0 ? '+' : ''}{service.changePercent.toFixed(1)}%)</span>
 </div>
 </div>
 </div>
 
 {/* Recommendations */}
 {showRecommendations && service.recommendations && service.recommendations.length > 0 && (
 <div className="mt-4 space-y-2">
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-yellow-600" />
 Cost Optimization Recommendations
 </h4>
 {service.recommendations.filter(r => r.status === 'pending').map(rec => (
 <div key={rec.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
 <div className="flex-1">
 <p className="text-sm text-gray-900 dark:text-gray-100">{rec.description}</p>
 <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
 <span>Savings: ${rec.estimatedSavings}/month</span>
 <span>Effort: {rec.effort}</span>
 <span>Impact: {rec.impact}</span>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => applyRecommendation(service.serviceId, rec.id)}
 className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded"
 title="Apply recommendation"
 >
 <Check className="w-4 h-4" />
 </button>
 <button
 onClick={() => dismissRecommendation(service.serviceId, rec.id)}
 className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
 title="Dismiss recommendation"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {viewMode === 'trends' && (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Cost Trends
 </h2>
 <ResponsiveContainer width="100%" height={400}>
 <AreaChart data={trends}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" />
 <YAxis />
 <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
 <Legend />
 <Area type="monotone" dataKey="total" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Total Cost" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 )}

 {viewMode === 'breakdown' && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Cost by Cloud Provider
 </h2>
 <ResponsiveContainer width="100%" height={300}>
 <RePieChart>
 <Pie
 data={pieData}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
 outerRadius={80}
 fill="#8884d8"
 dataKey="value"
 >
 {pieData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
 </RePieChart>
 </ResponsiveContainer>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Top 5 Services by Cost
 </h2>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={sortedServices.slice(0, 5)}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="serviceName" />
 <YAxis />
 <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
 <Bar dataKey="currentMonth" fill="#3B82F6" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}