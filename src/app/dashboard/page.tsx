'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
 Home,
 Star,
 PlayCircle,
 BookOpen,
 Settings,
 Bell,
 Search,
 Plus,
 Brain,
 GraduationCap,
 Lock,
 ExternalLink
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

interface QuickAction {
 id: string;
 title: string;
 description: string;
 icon: React.ComponentType<any>;
 color: string;
 href: string;
 isNew?: boolean;
}

interface PremiumPlugin {
 id: string;
 name: string;
 description: string;
 icon: React.ComponentType<any>;
 color: string;
 href: string;
 isPopular?: boolean;
}

const quickActions: QuickAction[] = [
 {
 id: 'create-service',
 title: 'Create Service',
 description: 'Bootstrap a new service from templates',
 icon: Plus,
 color: 'primary',
 href: '/create'
 },
 {
 id: 'software-catalog',
 title: 'Software Catalog',
 description: 'Browse all services and components',
 icon: Database,
 color: 'blue',
 href: '/catalog'
 },
 {
 id: 'tech-docs',
 title: 'TechDocs',
 description: 'View technical documentation',
 icon: BookOpen,
 color: 'green',
 href: '/docs'
 },
 {
 id: 'templates',
 title: 'Templates',
 description: 'Explore scaffolding templates',
 icon: GitBranch,
 color: 'purple',
 href: '/templates'
 }
];

const premiumPlugins: PremiumPlugin[] = [
 {
 id: 'soundcheck',
 name: 'Soundcheck',
 description: 'Tech health management and standards enforcement',
 icon: Shield,
 color: 'red',
 href: '/soundcheck',
 isPopular: true
 },
 {
 id: 'aika',
 name: 'AiKA',
 description: 'AI Knowledge Assistant for your organization',
 icon: Brain,
 color: 'purple',
 href: '/aika'
 },
 {
 id: 'skill-exchange',
 name: 'Skill Exchange',
 description: 'Internal learning marketplace',
 icon: GraduationCap,
 color: 'green',
 href: '/skill-exchange'
 },
 {
 id: 'insights',
 name: 'Insights',
 description: 'Portal usage analytics and metrics',
 icon: BarChart3,
 color: 'blue',
 href: '/insights'
 },
 {
 id: 'rbac',
 name: 'RBAC',
 description: 'Role-based access control',
 icon: Lock,
 color: 'orange',
 href: '/rbac'
 }
];

function MetricCard({ title, value, change, icon, bgColor, iconColor, loading = false }: MetricCardProps) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="spotify-card p-6"
 >
 <div className="flex items-center justify-between mb-4">
 <div className={`p-3 rounded-xl ${bgColor}`}>
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
 <div className="h-8 bg-muted rounded animate-pulse mb-2" />
 ) : (
 <h3 className="text-2xl font-bold text-foreground">{value}</h3>
 )}
 <p className="text-sm text-muted-foreground mt-1">{title}</p>
 </motion.div>
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
 <div className="spotify-layout min-h-screen">
 <div className="spotify-main-content">
 {/* Hero Section */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="mb-12"
 >
 <div className="flex items-center justify-between mb-8">
 <div>
 <div className="flex items-center gap-3 mb-3">
 <Home className="h-8 w-8 text-primary" />
 <h1 className="text-4xl font-bold spotify-gradient-text">Good morning</h1>
 </div>
 <p className="text-xl text-muted-foreground">
 Welcome back to your development portal
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
 <Bell className="h-5 w-5 text-muted-foreground" />
 </button>
 <button className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
 <Settings className="h-5 w-5 text-muted-foreground" />
 </button>
 </div>
 </div>
 </motion.div>

 {/* Quick Actions */}
 <div className="mb-12">
 <h2 className="text-2xl font-bold text-foreground mb-6">Quick Actions</h2>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
 {quickActions.map((action, index) => {
 const ActionIcon = action.icon;
 return (
 <motion.button
 key={action.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.1 }}
 onClick={() => router.push(action.href)}
 className="spotify-plugin-card group text-left"
 >
 <div className="flex items-center gap-4 mb-4">
 <div className={`p-4 rounded-xl ${
                  action.color === 'primary' ? 'bg-primary/10' :
                  action.color === 'blue' ? 'bg-blue-500/10' :
                  action.color === 'green' ? 'bg-green-500/10' :
                  action.color === 'purple' ? 'bg-purple-500/10' :
                  'bg-muted'
                }`}>
 <ActionIcon className={`h-8 w-8 ${
                  action.color === 'primary' ? 'text-primary' :
                  action.color === 'blue' ? 'text-blue-600' :
                  action.color === 'green' ? 'text-green-600' :
                  action.color === 'purple' ? 'text-purple-600' :
                  'text-foreground'
                }`} />
 </div>
 </div>
 <h3 className="text-lg font-bold text-foreground mb-2">{action.title}</h3>
 <p className="text-sm text-muted-foreground">{action.description}</p>
 </motion.button>
 );
 })}
 </div>
 </div>

 {/* Key Metrics */}
 <div className="mb-12">
 <h2 className="text-2xl font-bold text-foreground mb-6">Platform Overview</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <MetricCard
 title="Total Services"
 value={metrics?.totalServices ?? 0}
 change={metrics ? { value: 5.2, trend: 'up' } : undefined}
 icon={<Package className="w-6 h-6" />}
 bgColor="bg-blue-500/10"
 iconColor="text-blue-600"
 loading={loading.metrics}
 />
 <MetricCard
 title="Healthy Services"
 value={metrics ? `${metrics.healthyServices}/${metrics.totalServices}` : '0/0'}
 change={metrics ? { value: 2.1, trend: 'up' } : undefined}
 icon={<CheckCircle className="w-6 h-6" />}
 bgColor="bg-green-500/10"
 iconColor="text-green-600"
 loading={loading.metrics}
 />
 <MetricCard
 title="Deployments Today"
 value={metrics?.deploymentsToday ?? 0}
 change={metrics ? { value: 15.3, trend: 'up' } : undefined}
 icon={<GitBranch className="w-6 h-6" />}
 bgColor="bg-purple-500/10"
 iconColor="text-purple-600"
 loading={loading.metrics}
 />
 <MetricCard
 title="Active Incidents"
 value={metrics?.activeIncidents ?? 0}
 change={metrics ? { value: 33.3, trend: 'down' } : undefined}
 icon={<AlertCircle className="w-6 h-6" />}
 bgColor="bg-red-500/10"
 iconColor="text-red-600"
 loading={loading.metrics}
 />
 </div>
 </div>

 {/* Premium Features */}
 <div className="mb-12">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-2xl font-bold text-foreground">Premium Features</h2>
 <button
 onClick={() => router.push('/plugins')}
 className="spotify-button-secondary px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
 >
 View All
 <ExternalLink className="h-4 w-4" />
 </button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {premiumPlugins.map((plugin, index) => {
 const PluginIcon = plugin.icon;
 return (
 <motion.div
 key={plugin.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.1 }}
 onClick={() => router.push(plugin.href)}
 className="spotify-plugin-card group cursor-pointer relative"
 >
 {plugin.isPopular && (
 <div className="absolute top-4 right-4">
 <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
 <Star className="h-3 w-3" />
 Popular
 </div>
 </div>
 )}
 <div className="flex items-center gap-4 mb-4">
 <div className={`p-4 rounded-xl bg-${plugin.color}-500/10`}>
 <PluginIcon className={`h-8 w-8 text-${plugin.color}-600`} />
 </div>
 <div className="flex-1">
 <h3 className="text-lg font-bold text-foreground">{plugin.name}</h3>
 <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-2 py-1 rounded-full text-xs font-semibold">
 Premium
 </span>
 </div>
 </div>
 <p className="text-sm text-muted-foreground mb-4">{plugin.description}</p>
 <div className="flex items-center justify-between">
 <button className="spotify-button-primary py-2 px-4 rounded-lg text-sm font-semibold flex items-center gap-2">
 <PlayCircle className="h-4 w-4" />
 Launch
 </button>
 <ExternalLink className="h-4 w-4 text-muted-foreground" />
 </div>
 </motion.div>
 );
 })}
 </div>
 </div>

 {/* Recent Activity & Platform Stats */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
 {/* Recent Activity */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.3 }}
 className="lg:col-span-2 spotify-card p-6"
 >
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-bold text-foreground">Recent Activity</h2>
 <button
 onClick={() => router.push('/activity')}
 className="text-sm text-primary hover:text-primary/80 font-medium"
 >
 View all
 </button>
 </div>
 {loading.activity ? (
 <div className="space-y-4">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="flex items-start gap-3">
 <div className="w-8 h-8 bg-muted rounded-lg animate-pulse" />
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
 <div className="h-3 bg-muted rounded animate-pulse w-1/4" />
 </div>
 </div>
 ))}
 </div>
 ) : recentActivity.length === 0 ? (
 <div className="text-center py-12">
 <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
 <p className="text-muted-foreground">No recent activity</p>
 </div>
 ) : (
 <div className="space-y-4">
 {recentActivity.map((activity) => (
 <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
 <div className={`p-2 rounded-lg ${
 activity.status === 'success' ? 'bg-green-500/10 text-green-600' :
 activity.status === 'warning' ? 'bg-yellow-500/10 text-yellow-600' :
 activity.status === 'error' ? 'bg-red-500/10 text-red-600' :
 'bg-blue-500/10 text-blue-600'
 }`}>
 {activity.type === 'deployment' ? <GitBranch className="w-4 h-4" /> :
 activity.type === 'alert' ? <AlertCircle className="w-4 h-4" /> :
 <Activity className="w-4 h-4" />}
 </div>
 <div className="flex-1">
 <p className="text-sm text-foreground font-medium">{activity.message}</p>
 <p className="text-xs text-muted-foreground mt-1">
 {activity.timestamp ? formatRelativeTime(activity.timestamp) : activity.time}
 </p>
 </div>
 </div>
 ))}
 </div>
 )}
 </motion.div>

 {/* Platform Stats */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4 }}
 className="spotify-card p-6"
 >
 <h2 className="text-xl font-bold text-foreground mb-6">Platform Stats</h2>
 {loading.metrics ? (
 <div className="space-y-4">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 bg-muted rounded animate-pulse" />
 <div className="h-4 bg-muted rounded animate-pulse w-24" />
 </div>
 <div className="h-4 bg-muted rounded animate-pulse w-16" />
 </div>
 ))}
 </div>
 ) : (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Users className="w-5 h-5 text-primary" />
 <span className="text-sm text-muted-foreground">Active Users</span>
 </div>
 <span className="text-sm font-semibold text-foreground">
 {metrics?.activeUsers ?? 0}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Zap className="w-5 h-5 text-primary" />
 <span className="text-sm text-muted-foreground">API Calls</span>
 </div>
 <span className="text-sm font-semibold text-foreground">
 {metrics?.apiCalls ?? '0'}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Clock className="w-5 h-5 text-primary" />
 <span className="text-sm text-muted-foreground">Response Time</span>
 </div>
 <span className="text-sm font-semibold text-foreground">
 {metrics?.avgResponseTime ?? '0ms'}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Shield className="w-5 h-5 text-primary" />
 <span className="text-sm text-muted-foreground">Uptime</span>
 </div>
 <span className="text-sm font-semibold text-primary">
 {metrics?.uptime ?? '99.9%'}
 </span>
 </div>
 </div>
 )}
 </motion.div>
 </div>

 {/* Top Services */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.5 }}
 className="spotify-card p-6"
 >
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-bold text-foreground">Top Services</h2>
 <button
 onClick={() => router.push('/catalog')}
 className="text-sm text-primary hover:text-primary/80 font-medium"
 >
 View all services
 </button>
 </div>
 {loading.services ? (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="text-left text-sm text-muted-foreground border-b border-border">
 <th className="pb-3 font-semibold">Service</th>
 <th className="pb-3 font-semibold">Requests</th>
 <th className="pb-3 font-semibold">Health</th>
 <th className="pb-3 font-semibold">CPU</th>
 <th className="pb-3 font-semibold">Memory</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {[...Array(4)].map((_, i) => (
 <tr key={i} className="text-sm">
 <td className="py-4">
 <div className="h-4 bg-muted rounded animate-pulse w-32" />
 </td>
 <td className="py-4">
 <div className="h-4 bg-muted rounded animate-pulse w-16" />
 </td>
 <td className="py-4">
 <div className="h-6 bg-muted rounded-full animate-pulse w-20" />
 </td>
 <td className="py-4">
 <div className="h-4 bg-muted rounded animate-pulse w-20" />
 </td>
 <td className="py-4">
 <div className="h-4 bg-muted rounded animate-pulse w-20" />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : topServices.length === 0 ? (
 <div className="text-center py-12">
 <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
 <p className="text-muted-foreground">No services found</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="text-left text-sm text-muted-foreground border-b border-border">
 <th className="pb-3 font-semibold">Service</th>
 <th className="pb-3 font-semibold">Requests</th>
 <th className="pb-3 font-semibold">Health</th>
 <th className="pb-3 font-semibold">CPU</th>
 <th className="pb-3 font-semibold">Memory</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {Array.isArray(topServices) && topServices.map((service) => {
 const serviceName = service.metadata?.name || 'Unknown';
 const health = service.status?.health || 'unknown';
 const requests = service.status?.metrics?.requests || '0';
 const cpu = service.status?.metrics?.cpu || 0;
 const memory = service.status?.metrics?.memory || 0;
 
 return (
 <tr key={serviceName} className="text-sm hover:bg-muted/30 transition-colors">
 <td className="py-4">
 <button
 onClick={() => router.push(`/catalog/${serviceName}`)}
 className="font-semibold text-foreground hover:text-primary transition-colors"
 >
 {service.metadata?.title || serviceName}
 </button>
 </td>
 <td className="py-4 text-muted-foreground">{requests}</td>
 <td className="py-4">
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
 health === 'healthy' 
 ? 'bg-green-100 text-green-700'
 : health === 'degraded'
 ? 'bg-yellow-100 text-yellow-700'
 : health === 'unhealthy'
 ? 'bg-red-100 text-red-700'
 : 'bg-gray-100 text-gray-700'
 }`}>
 <div className={`w-1.5 h-1.5 rounded-full ${
 health === 'healthy' ? 'bg-green-600' : 
 health === 'degraded' ? 'bg-yellow-600' : 
 health === 'unhealthy' ? 'bg-red-600' : 'bg-gray-600'
 }`} />
 {health}
 </span>
 </td>
 <td className="py-4">
 <div className="flex items-center gap-2">
 <div className="w-16 bg-muted rounded-full h-2">
 <div 
 className={`h-2 rounded-full transition-all ${
 cpu > 70 ? 'bg-red-500' : cpu > 50 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(cpu, 100)}%` }}
 />
 </div>
 <span className="text-xs text-muted-foreground">{cpu}%</span>
 </div>
 </td>
 <td className="py-4">
 <div className="flex items-center gap-2">
 <div className="w-16 bg-muted rounded-full h-2">
 <div 
 className={`h-2 rounded-full transition-all ${
 memory > 70 ? 'bg-red-500' : memory > 50 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(memory, 100)}%` }}
 />
 </div>
 <span className="text-xs text-muted-foreground">{memory}%</span>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </motion.div>
 </div>
 </div>
 );
}