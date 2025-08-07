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
 GitBranch,
 Package,
 Users,
 AlertCircle,
 CheckCircle,
 Clock,
 Zap,
 Database,
 FileText,
 User,
 Filter,
 RefreshCw,
 Pin,
 Archive,
 Eye,
 ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

import { useWebSocket } from '@/lib/websocket/client';

export interface ActivityItem {
 id: string;
 type: 'deployment' | 'incident' | 'service_created' | 'service_updated' | 'template_used' | 'user_joined' | 'alert' | 'comment' | 'approval' | 'merge' | 'release';
 title: string;
 description: string;
 timestamp: string;
 actor: {
 name: string;
 email: string;
 avatar?: string;
 };
 target?: {
 type: 'service' | 'template' | 'user' | 'system' | 'deployment' | 'pr';
 name: string;
 url?: string;
 };
 metadata?: {
 severity?: 'low' | 'medium' | 'high' | 'critical';
 status?: 'success' | 'failure' | 'pending' | 'cancelled';
 environment?: string;
 version?: string;
 tags?: string[];
 [key: string]: any;
 };
 read: boolean;
 pinned: boolean;
 archived: boolean;
}

interface ActivityFilters {
 types: string[];
 timeRange: 'hour' | 'day' | 'week' | 'month' | 'all';
 severity: string[];
 actors: string[];
 targets: string[];
 showRead: boolean;
 showArchived: boolean;
}

interface ActivityFeedProps {
 compact?: boolean;
 maxItems?: number;
 showFilters?: boolean;
 autoRefresh?: boolean;
 className?: string;
}

export default function ActivityFeed({ 
 compact = false, 
 maxItems = 50, 
 showFilters = true, 
 autoRefresh = true,
 className = '' 
}: ActivityFeedProps) {
 const router = useRouter();
 const { isConnected } = useWebSocket();
 
 // State
 const [activities, setActivities] = useState<ActivityItem[]>([]);
 const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [showFilterPanel, setShowFilterPanel] = useState(false);
 const [_selectedItems, _setSelectedItems] = useState<string[]>([]);
 const [filters, setFilters] = useState<ActivityFilters>({
 types: [],
 timeRange: 'all',
 severity: [],
 actors: [],
 targets: [],
 showRead: true,
 showArchived: false
 });

 // Load activities
 const loadActivities = useCallback(async () => {
 try {
 setLoading(true);
 
 // In a real implementation, this would come from a backend API
 // For now, we'll generate mock activity data
 const mockActivities: ActivityItem[] = [
 {
 id: '1',
 type: 'deployment',
 title: 'Production deployment completed',
 description: 'user-service v2.1.0 successfully deployed to production environment',
 timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
 actor: { name: 'Alice Johnson', email: 'alice@company.com' },
 target: { type: 'service', name: 'user-service', url: '/catalog/default/component/user-service' },
 metadata: { status: 'success', environment: 'production', version: 'v2.1.0' },
 read: false,
 pinned: false,
 archived: false
 },
 {
 id: '2',
 type: 'incident',
 title: 'High error rate detected',
 description: 'Payment service experiencing elevated error rates above threshold',
 timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
 actor: { name: 'Monitoring System', email: 'system@company.com' },
 target: { type: 'service', name: 'payment-service', url: '/catalog/default/component/payment-service' },
 metadata: { severity: 'high', status: 'pending', environment: 'production' },
 read: false,
 pinned: true,
 archived: false
 },
 {
 id: '3',
 type: 'service_created',
 title: 'New service created',
 description: 'notification-service has been added to the service catalog',
 timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
 actor: { name: 'Bob Smith', email: 'bob@company.com' },
 target: { type: 'service', name: 'notification-service', url: '/catalog/default/component/notification-service' },
 metadata: { status: 'success', tags: ['microservice', 'nodejs'] },
 read: true,
 pinned: false,
 archived: false
 },
 {
 id: '4',
 type: 'template_used',
 title: 'Template executed',
 description: 'Created new microservice using Node.js template',
 timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
 actor: { name: 'Charlie Brown', email: 'charlie@company.com' },
 target: { type: 'template', name: 'nodejs-microservice', url: '/templates/default/nodejs-microservice' },
 metadata: { status: 'success' },
 read: true,
 pinned: false,
 archived: false
 },
 {
 id: '5',
 type: 'user_joined',
 title: 'New team member',
 description: 'Diana Prince joined the platform team',
 timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
 actor: { name: 'Diana Prince', email: 'diana@company.com' },
 target: { type: 'user', name: 'Diana Prince' },
 metadata: { status: 'success' },
 read: true,
 pinned: false,
 archived: false
 },
 {
 id: '6',
 type: 'alert',
 title: 'Disk space warning',
 description: 'Database server disk usage above 85% threshold',
 timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
 actor: { name: 'Infrastructure Monitor', email: 'system@company.com' },
 target: { type: 'system', name: 'db-server-01' },
 metadata: { severity: 'medium', status: 'pending' },
 read: true,
 pinned: false,
 archived: false
 },
 {
 id: '7',
 type: 'merge',
 title: 'Pull request merged',
 description: 'Feature/user-authentication merged to main branch',
 timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
 actor: { name: 'Alice Johnson', email: 'alice@company.com' },
 target: { type: 'pr', name: 'user-service#42' },
 metadata: { status: 'success' },
 read: true,
 pinned: false,
 archived: false
 }
 ];

 setActivities(mockActivities);
 } catch (error) {
 console.error('Failed to load activities:', error);
 toast.error('Failed to load activity feed');
 } finally {
 setLoading(false);
 }
 }, []);

 // Apply filters
 useEffect(() => {
 let filtered = [...activities];

 // Type filter
 if (filters.types.length > 0) {
 filtered = filtered.filter(item => filters.types.includes(item.type));
 }

 // Time range filter
 if (filters.timeRange !== 'all') {
 const now = Date.now();
 const timeRanges = {
 hour: 60 * 60 * 1000,
 day: 24 * 60 * 60 * 1000,
 week: 7 * 24 * 60 * 60 * 1000,
 month: 30 * 24 * 60 * 60 * 1000
 };
 const cutoff = now - timeRanges[filters.timeRange];
 filtered = filtered.filter(item => new Date(item.timestamp).getTime() > cutoff);
 }

 // Severity filter
 if (filters.severity.length > 0) {
 filtered = filtered.filter(item => 
 item.metadata?.severity && filters.severity.includes(item.metadata.severity)
 );
 }

 // Read/archived filters
 if (!filters.showRead) {
 filtered = filtered.filter(item => !item.read);
 }
 if (!filters.showArchived) {
 filtered = filtered.filter(item => !item.archived);
 }

 // Limit items
 filtered = filtered.slice(0, maxItems);

 setFilteredActivities(filtered);
 }, [activities, filters, maxItems]);

 // Real-time updates
 useEffect(() => {
 if (!isConnected || !autoRefresh) return;

 const interval = setInterval(() => {
 // Simulate new activities
 if (Math.random() > 0.7) {
 const newActivity: ActivityItem = {
 id: Date.now().toString(),
 type: ['deployment', 'incident', 'service_updated'][Math.floor(Math.random() * 3)] as any,
 title: 'New activity detected',
 description: 'Real-time activity update',
 timestamp: new Date().toISOString(),
 actor: { name: 'System', email: 'system@company.com' },
 read: false,
 pinned: false,
 archived: false
 };
 
 setActivities(prev => [newActivity, ...prev]);
 }
 }, 30000); // Check every 30 seconds

 return () => clearInterval(interval);
 }, [isConnected, autoRefresh]);

 // Initial load
 useEffect(() => {
 loadActivities();
 }, [loadActivities]);

 // Helper functions
 const getActivityIcon = (type: string, metadata?: any) => {
 const iconClass = "w-5 h-5";
 
 switch (type) {
 case 'deployment':
 return metadata?.status === 'success' 
 ? <CheckCircle className={`${iconClass} text-green-600`} />
 : metadata?.status === 'failure'
 ? <AlertCircle className={`${iconClass} text-red-600`} />
 : <Clock className={`${iconClass} text-yellow-600`} />;
 case 'incident':
 case 'alert':
 return <AlertCircle className={`${iconClass} text-red-600`} />;
 case 'service_created':
 case 'service_updated':
 return <Package className={`${iconClass} text-blue-600`} />;
 case 'template_used':
 return <FileText className={`${iconClass} text-purple-600`} />;
 case 'user_joined':
 return <Users className={`${iconClass} text-green-600`} />;
 case 'merge':
 return <GitBranch className={`${iconClass} text-indigo-600`} />;
 case 'release':
 return <Zap className={`${iconClass} text-orange-600`} />;
 default:
 return <Activity className={`${iconClass} text-gray-600`} />;
 }
 };

 const handleItemClick = (item: ActivityItem) => {
 if (item.target?.url) {
 router.push(item.target.url);
 }
 };

 const markAsRead = (id: string) => {
 setActivities(prev => prev.map(item => 
 item.id === id ? { ...item, read: true } : item
 ));
 };

 const markAllAsRead = () => {
 setActivities(prev => prev.map(item => ({ ...item, read: true })));
 toast.success('All activities marked as read');
 };

 const togglePin = (id: string) => {
 setActivities(prev => prev.map(item => 
 item.id === id ? { ...item, pinned: !item.pinned } : item
 ));
 };

 const archiveItem = (id: string) => {
 setActivities(prev => prev.map(item => 
 item.id === id ? { ...item, archived: true } : item
 ));
 toast.success('Activity archived');
 };

 const refreshFeed = async () => {
 setRefreshing(true);
 await loadActivities();
 setRefreshing(false);
 toast.success('Activity feed refreshed');
 };

 const unreadCount = activities.filter(item => !item.read && !item.archived).length;

 return (
 <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-3">
 <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Activity Feed
 </h3>
 {unreadCount > 0 && (
 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
 {unreadCount} new
 </span>
 )}
 </div>
 
 <div className="flex items-center gap-2">
 {showFilters && (
 <button
 onClick={() => setShowFilterPanel(!showFilterPanel)}
 className={`p-2 rounded-md transition-colors ${
 showFilterPanel 
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
 : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
 }`}
 >
 <Filter className="w-4 h-4" />
 </button>
 )}
 
 <button
 onClick={refreshFeed}
 disabled={refreshing}
 className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
 >
 <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
 </button>
 
 {unreadCount > 0 && (
 <button
 onClick={markAllAsRead}
 className="px-3 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/30"
 >
 Mark all read
 </button>
 )}
 </div>
 </div>

 {/* Filters Panel */}
 <AnimatePresence>
 {showFilterPanel && showFilters && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900 overflow-hidden"
 >
 <div className="space-y-4">
 {/* Type Filters */}
 <div>
 <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
 Activity Types
 </label>
 <div className="flex flex-wrap gap-2">
 {['deployment', 'incident', 'service_created', 'template_used', 'user_joined', 'alert'].map(type => (
 <button
 key={type}
 onClick={() => {
 setFilters(prev => ({
 ...prev,
 types: prev.types.includes(type)
 ? prev.types.filter(t => t !== type)
 : [...prev.types, type]
 }));
 }}
 className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
 filters.types.includes(type)
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
 : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
 }`}
 >
 {type.replace('_', ' ')}
 </button>
 ))}
 </div>
 </div>

 {/* Time Range */}
 <div>
 <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
 Time Range
 </label>
 <select
 value={filters.timeRange}
 onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
 className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-sm"
 >
 <option value="all">All time</option>
 <option value="hour">Last hour</option>
 <option value="day">Last day</option>
 <option value="week">Last week</option>
 <option value="month">Last month</option>
 </select>
 </div>

 {/* Show/Hide Options */}
 <div className="flex gap-4">
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={filters.showRead}
 onChange={(e) => setFilters(prev => ({ ...prev, showRead: e.target.checked }))}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">Show read</span>
 </label>
 
 <label className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={filters.showArchived}
 onChange={(e) => setFilters(prev => ({ ...prev, showArchived: e.target.checked }))}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">Show archived</span>
 </label>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Activity List */}
 <div className="max-h-96 overflow-y-auto">
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
 </div>
 ) : filteredActivities.length === 0 ? (
 <div className="text-center py-8">
 <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
 <p className="text-gray-500 dark:text-gray-400">
 {filters.types.length > 0 || filters.timeRange !== 'all' 
 ? 'No activities match your filters'
 : 'No recent activity'
 }
 </p>
 </div>
 ) : (
 <div className="divide-y divide-gray-200 dark:divide-gray-700">
 {filteredActivities.map((item, index) => (
 <motion.div
 key={item.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05 }}
 className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
 !item.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
 } ${item.pinned ? 'border-l-4 border-blue-500' : ''}`}
 >
 <div className="flex items-start gap-3">
 {/* Icon */}
 <div className="flex-shrink-0 mt-0.5">
 {getActivityIcon(item.type, item.metadata)}
 </div>
 
 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between">
 <div 
 className={`flex-1 ${item.target?.url ? 'cursor-pointer' : ''}`}
 onClick={() => handleItemClick(item)}
 >
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
 {item.title}
 {item.target?.url && (
 <ExternalLink className="w-3 h-3 ml-1 inline text-gray-400" />
 )}
 </p>
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
 {item.description}
 </p>
 
 {/* Metadata */}
 <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
 <span className="flex items-center gap-1">
 <User className="w-3 h-3" />
 {item.actor.name}
 </span>
 <span className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 {getRelativeTimeString(new Date(item.timestamp))}
 </span>
 {item.metadata?.environment && (
 <span className="flex items-center gap-1">
 <Database className="w-3 h-3" />
 {item.metadata.environment}
 </span>
 )}
 {item.metadata?.severity && (
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
 item.metadata.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
 item.metadata.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300' :
 item.metadata.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
 }`}>
 {item.metadata.severity}
 </span>
 )}
 </div>
 </div>
 
 {/* Actions */}
 <div className="flex items-center gap-1 ml-3">
 {!item.read && (
 <button
 onClick={() => markAsRead(item.id)}
 className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
 title="Mark as read"
 >
 <Eye className="w-4 h-4" />
 </button>
 )}
 
 <button
 onClick={() => togglePin(item.id)}
 className={`p-1 transition-colors ${
 item.pinned 
 ? 'text-blue-600 dark:text-blue-400' 
 : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
 }`}
 title={item.pinned ? 'Unpin' : 'Pin'}
 >
 <Pin className="w-4 h-4" />
 </button>
 
 <button
 onClick={() => archiveItem(item.id)}
 className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 title="Archive"
 >
 <Archive className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </div>

 {/* Footer */}
 {!compact && filteredActivities.length > 0 && (
 <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
 <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
 <span>
 Showing {filteredActivities.length} of {activities.length} activities
 </span>
 <button
 onClick={() => router.push('/activity')}
 className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 View all activity 
 </button>
 </div>
 </div>
 )}
 </div>
 );
}