'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
 BarChart3,
 Shield,
 Database,
 ArrowUpRight,
 ArrowDownRight,
 Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MetricCardProps {
 title: string;
 value: string | number;
 change?: {
 value: number;
 trend: 'up' | 'down';
 };
 icon: React.ReactNode;
 bgColor: string;
 iconColor: string;
 loading?: boolean;
}

interface CatalogStats {
 totalServices: number;
 healthyServices: number;
 deploymentsToday: number;
 activeIncidents: number;
 activeUsers: number;
 apiCalls: string;
 avgResponseTime: string;
 uptime: string;
}

interface ActivityItem {
 id: string;
 type: 'deployment' | 'alert' | 'service' | 'incident';
 message: string;
 time: string;
 status: 'success' | 'warning' | 'error' | 'info';
 timestamp: string;
}

interface ServiceEntity {
 metadata: {
 name: string;
 title?: string;
 };
 spec?: {
 type?: string;
 };
 status?: {
 health?: 'healthy' | 'degraded' | 'unhealthy';
 metrics?: {
 requests?: string;
 cpu?: number;
 memory?: number;
 };
 };
}

function MetricCard({ title, value, change, icon, bgColor, iconColor, loading = false }: MetricCardProps) {
 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 <div className={`p-3 rounded-lg ${bgColor}`}>
 <div className={iconColor}>{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : icon}</div>
 </div>
 {change && !loading && (
 <div className={`flex items-center gap-1 text-sm ${change.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
 {change.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
 <span>{Math.abs(change.value)}%</span>
 </div>
 )}
 </div>
 {loading ? (
 <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
 ) : (
 <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</h3>
 )}
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{title}</p>
 </div>
 );
}

export default function DashboardPage() {
 const router = useRouter();
 const abortControllers = useRef<Map<string, AbortController>>(new Map());
 const mounted = useRef(true);

 // State management
 const [metrics, setMetrics] = useState<CatalogStats | null>(null);
 const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
 const [topServices, setTopServices] = useState<ServiceEntity[]>([]);
 const [loading, setLoading] = useState({
 metrics: true,
 activity: true,
 services: true,
 });
 const [errors, setErrors] = useState({
 metrics: null as string | null,
 activity: null as string | null,
 services: null as string | null,
 });

 // Helper function to fetch with timeout and abort controller
 const fetchWithTimeout = async (url: string, key: string, timeout = 5000) => {
   // Abort any existing request for this key
   if (abortControllers.current.has(key)) {
     abortControllers.current.get(key)?.abort();
   }

   const controller = new AbortController();
   abortControllers.current.set(key, controller);

   const timeoutId = setTimeout(() => controller.abort(), timeout);

   try {
     const response = await fetch(url, { 
       signal: controller.signal,
       headers: {
         'Content-Type': 'application/json',
       }
     });
     clearTimeout(timeoutId);
     
     if (!response.ok) {
       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
     }
     
     return await response.json();
   } catch (error: any) {
     clearTimeout(timeoutId);
     if (error.name === 'AbortError') {
       throw new Error('Request timeout');
     }
     throw error;
   } finally {
     abortControllers.current.delete(key);
   }
 };

 // API fetch functions with better error handling
 const fetchCatalogStats = useCallback(async () => {
   if (!mounted.current) return;
   
   try {
     const data = await fetchWithTimeout('/api/catalog/stats', 'stats', 3000);
     if (mounted.current) {
       setMetrics(data);
       setErrors(prev => ({ ...prev, metrics: null }));
     }
   } catch (error) {
     console.error('Error fetching catalog stats:', error);
     if (mounted.current) {
       // Set default values on error
       setMetrics({
         totalServices: 0,
         healthyServices: 0,
         deploymentsToday: 0,
         activeIncidents: 0,
         activeUsers: 0,
         apiCalls: '0',
         avgResponseTime: '0ms',
         uptime: '99.9%'
       });
       setErrors(prev => ({ ...prev, metrics: null })); // Don't show error for stats
     }
   } finally {
     if (mounted.current) {
       setLoading(prev => ({ ...prev, metrics: false }));
     }
   }
 }, []);

 const fetchRecentActivity = useCallback(async () => {
   if (!mounted.current) return;
   
   try {
     const data = await fetchWithTimeout('/api/notifications?limit=4', 'activity', 3000);
     if (mounted.current) {
       const notifications = data.notifications || [];
       const activities = notifications.map((n: any) => ({
         id: n.id,
         type: n.type === 'success' ? 'deployment' : n.type === 'warning' || n.type === 'error' ? 'alert' : 'service',
         message: n.title,
         time: n.timestamp,
         status: n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info',
         timestamp: n.timestamp
       }));
       setRecentActivity(activities);
       setErrors(prev => ({ ...prev, activity: null }));
     }
   } catch (error) {
     console.error('Error fetching activity:', error);
     if (mounted.current) {
       setRecentActivity([]); // Empty array on error
       setErrors(prev => ({ ...prev, activity: null })); // Don't show error for activity
     }
   } finally {
     if (mounted.current) {
       setLoading(prev => ({ ...prev, activity: false }));
     }
   }
 }, []);

 const fetchTopServices = useCallback(async () => {
   if (!mounted.current) return;
   
   try {
     const data = await fetchWithTimeout('/api/backstage/entities?kind=Component&limit=4', 'services', 3000);
     if (mounted.current) {
       const services = Array.isArray(data) ? data : (data.items || []);
       setTopServices(services);
       setErrors(prev => ({ ...prev, services: null }));
     }
   } catch (error) {
     console.error('Error fetching services:', error);
     if (mounted.current) {
       setTopServices([]); // Empty array on error
       setErrors(prev => ({ ...prev, services: null })); // Don't show error for services
     }
   } finally {
     if (mounted.current) {
       setLoading(prev => ({ ...prev, services: false }));
     }
   }
 }, []);

 // Load data on component mount with parallel fetching
 useEffect(() => {
   mounted.current = true;
   
   // Fetch all data in parallel
   Promise.all([
     fetchCatalogStats(),
     fetchRecentActivity(),
     fetchTopServices()
   ]).catch(console.error);

   // Cleanup function
   return () => {
     mounted.current = false;
     // Abort all pending requests
     abortControllers.current.forEach(controller => controller.abort());
     abortControllers.current.clear();
   };
 }, [fetchCatalogStats, fetchRecentActivity, fetchTopServices]);

 // Helper function to format relative time
 const formatRelativeTime = (timestamp: string) => {
 const now = new Date();
 const time = new Date(timestamp);
 const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
 
 if (diffInMinutes < 1) return 'Just now';
 if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
 
 const diffInHours = Math.floor(diffInMinutes / 60);
 if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
 
 const diffInDays = Math.floor(diffInHours / 24);
 return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
 <p className="text-gray-600 dark:text-gray-400 mt-1">
 Welcome back! Here's what's happening with your platform.
 </p>
 </div>
 <button
 onClick={() => router.push('/create')}
 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
 >
 Create Service
 </button>
 </div>

 {/* Key Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <MetricCard
 title="Total Services"
 value={metrics?.totalServices ?? 0}
 change={metrics ? { value: 5.2, trend: 'up' } : undefined}
 icon={<Package className="w-6 h-6" />}
 bgColor="bg-blue-100 dark:bg-blue-900/20"
 iconColor="text-blue-600 dark:text-blue-400"
 loading={loading.metrics}
 />
 <MetricCard
 title="Healthy Services"
 value={metrics ? `${metrics.healthyServices}/${metrics.totalServices}` : '0/0'}
 change={metrics ? { value: 2.1, trend: 'up' } : undefined}
 icon={<CheckCircle className="w-6 h-6" />}
 bgColor="bg-green-100 dark:bg-green-900/20"
 iconColor="text-green-600 dark:text-green-400"
 loading={loading.metrics}
 />
 <MetricCard
 title="Deployments Today"
 value={metrics?.deploymentsToday ?? 0}
 change={metrics ? { value: 15.3, trend: 'up' } : undefined}
 icon={<GitBranch className="w-6 h-6" />}
 bgColor="bg-purple-100 dark:bg-purple-900/20"
 iconColor="text-purple-600 dark:text-purple-400"
 loading={loading.metrics}
 />
 <MetricCard
 title="Active Incidents"
 value={metrics?.activeIncidents ?? 0}
 change={metrics ? { value: 33.3, trend: 'down' } : undefined}
 icon={<AlertCircle className="w-6 h-6" />}
 bgColor="bg-red-100 dark:bg-red-900/20"
 iconColor="text-red-600 dark:text-red-400"
 loading={loading.metrics}
 />
 </div>

 {/* Platform Overview */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Recent Activity */}
 <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h2>
 {loading.activity ? (
 <div className="space-y-4">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="flex items-start gap-3">
 <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
 <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4" />
 </div>
 </div>
 ))}
 </div>
 ) : recentActivity.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p>No recent activity</p>
 </div>
 ) : (
 <div className="space-y-4">
 {recentActivity.map((activity) => (
 <div key={activity.id} className="flex items-start gap-3">
 <div className={`p-2 rounded-lg ${
 activity.status === 'success' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
 activity.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' :
 activity.status === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
 }`}>
 {activity.type === 'deployment' ? <GitBranch className="w-4 h-4" /> :
 activity.type === 'alert' ? <AlertCircle className="w-4 h-4" /> :
 <Activity className="w-4 h-4" />}
 </div>
 <div className="flex-1">
 <p className="text-sm text-gray-900 dark:text-gray-100">{activity.message}</p>
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {activity.timestamp ? formatRelativeTime(activity.timestamp) : activity.time}
 </p>
 </div>
 </div>
 ))}
 </div>
 )}
 {!loading.activity && (
 <button
 onClick={() => router.push('/activity')}
 className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 View all activity 
 </button>
 )}
 </div>

 {/* Platform Stats */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Platform Stats</h2>
 {loading.metrics ? (
 <div className="space-y-4">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
 </div>
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" />
 </div>
 ))}
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Users className="w-4 h-4 text-gray-400" />
 <span className="text-sm text-gray-600 dark:text-gray-400">Active Users</span>
 </div>
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {metrics?.activeUsers ?? 0}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Zap className="w-4 h-4 text-gray-400" />
 <span className="text-sm text-gray-600 dark:text-gray-400">API Calls</span>
 </div>
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {metrics?.apiCalls ?? '0'}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Clock className="w-4 h-4 text-gray-400" />
 <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</span>
 </div>
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {metrics?.avgResponseTime ?? '0ms'}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Shield className="w-4 h-4 text-gray-400" />
 <span className="text-sm text-gray-600 dark:text-gray-400">Platform Uptime</span>
 </div>
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {metrics?.uptime ?? '99.9%'}
 </span>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Top Services */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Top Services</h2>
 <button
 onClick={() => router.push('/catalog')}
 className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 View all services 
 </button>
 </div>
 {loading.services ? (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="text-left text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
 <th className="pb-3 font-medium">Service</th>
 <th className="pb-3 font-medium">Requests</th>
 <th className="pb-3 font-medium">Health</th>
 <th className="pb-3 font-medium">CPU</th>
 <th className="pb-3 font-medium">Memory</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {[...Array(4)].map((_, i) => (
 <tr key={i} className="text-sm">
 <td className="py-3">
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
 </td>
 <td className="py-3">
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" />
 </td>
 <td className="py-3">
 <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse w-20" />
 </td>
 <td className="py-3">
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
 </td>
 <td className="py-3">
 <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : topServices.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p>No services found</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="text-left text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
 <th className="pb-3 font-medium">Service</th>
 <th className="pb-3 font-medium">Requests</th>
 <th className="pb-3 font-medium">Health</th>
 <th className="pb-3 font-medium">CPU</th>
 <th className="pb-3 font-medium">Memory</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {Array.isArray(topServices) && topServices.map((service) => {
 const serviceName = service.metadata?.name || 'Unknown';
 const health = service.status?.health || 'unknown';
 const requests = service.status?.metrics?.requests || '0';
 const cpu = service.status?.metrics?.cpu || 0;
 const memory = service.status?.metrics?.memory || 0;
 
 return (
 <tr key={serviceName} className="text-sm">
 <td className="py-3">
 <button
 onClick={() => router.push(`/catalog/${serviceName}`)}
 className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
 >
 {service.metadata?.title || serviceName}
 </button>
 </td>
 <td className="py-3 text-gray-600 dark:text-gray-400">{requests}</td>
 <td className="py-3">
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
 health === 'healthy' 
 ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
 : health === 'degraded'
 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
 : health === 'unhealthy'
 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
 : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
 }`}>
 <div className={`w-1.5 h-1.5 rounded-full ${
 health === 'healthy' ? 'bg-green-600' : 
 health === 'degraded' ? 'bg-yellow-600' : 
 health === 'unhealthy' ? 'bg-red-600' : 'bg-gray-600'
 }`} />
 {health}
 </span>
 </td>
 <td className="py-3">
 <div className="flex items-center gap-2">
 <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
 <div 
 className={`h-2 rounded-full ${
 cpu > 70 ? 'bg-red-500' : cpu > 50 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(cpu, 100)}%` }}
 />
 </div>
 <span className="text-xs text-gray-600 dark:text-gray-400">{cpu}%</span>
 </div>
 </td>
 <td className="py-3">
 <div className="flex items-center gap-2">
 <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
 <div 
 className={`h-2 rounded-full ${
 memory > 70 ? 'bg-red-500' : memory > 50 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(memory, 100)}%` }}
 />
 </div>
 <span className="text-xs text-gray-600 dark:text-gray-400">{memory}%</span>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Quick Actions */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <button
 onClick={() => router.push('/catalog')}
 className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-center"
 >
 <Database className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Service Catalog</span>
 </button>
 <button
 onClick={() => router.push('/deployments')}
 className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-center"
 >
 <GitBranch className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Deployments</span>
 </button>
 <button
 onClick={() => router.push('/monitoring')}
 className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-center"
 >
 <BarChart3 className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Monitoring</span>
 </button>
 <button
 onClick={() => router.push('/health')}
 className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-center"
 >
 <Shield className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Health Status</span>
 </button>
 </div>
 </div>
 );
}