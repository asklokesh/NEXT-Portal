'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
 Activity, 
 Filter, 
 Download, 
 Search, 
 Calendar,
 User,
 FileText,
 RefreshCw,
 TrendingUp,
 Users,
 Shield,
 Database,
 Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
 LineChart, 
 Line, 
 BarChart, 
 Bar, 
 PieChart, 
 Pie, 
 Cell, 
 XAxis, 
 YAxis, 
 CartesianGrid, 
 Tooltip, 
 ResponsiveContainer
} from '@/components/charts';

interface AuditLog {
 id: string;
 userId?: string;
 userName?: string;
 action: string;
 resource: string;
 resourceId?: string;
 metadata?: Record<string, any>;
 ipAddress?: string;
 userAgent?: string;
 timestamp: string;
}

interface AuditStats {
 todayCount: number;
 yesterdayCount: number;
 weekCount: number;
 monthCount: number;
 topActions: Array<{ action: string; count: number }>;
 topResources: Array<{ resource: string; count: number }>;
 topUsers: Array<{ userId: string; userName?: string; count: number }>;
 activityByHour: Array<{ hour: string; count: number }>;
 activityByDay: Array<{ day: string; count: number }>;
}

const ACTION_COLORS: Record<string, string> = {
 create: '#10b981',
 update: '#3b82f6',
 delete: '#ef4444',
 view: '#6b7280',
 login: '#8b5cf6',
 logout: '#f59e0b',
 error: '#dc2626',
 default: '#6b7280'
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
 service: <Database className="w-4 h-4" />,
 user: <User className="w-4 h-4" />,
 template: <FileText className="w-4 h-4" />,
 settings: <Shield className="w-4 h-4" />,
 default: <Activity className="w-4 h-4" />
};

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

export default function ActivityContent() {
 const [logs, setLogs] = useState<AuditLog[]>([]);
 const [stats, setStats] = useState<AuditStats | null>(null);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
 const [showFilters, setShowFilters] = useState(false);
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [searchQuery, setSearchQuery] = useState('');
 
 // Filters
 const [filters, setFilters] = useState({
 action: '',
 resource: '',
 userId: '',
 startDate: '',
 endDate: ''
 });

 // Load audit logs
 const loadLogs = useCallback(async () => {
 try {
 const params = new URLSearchParams();
 params.append('page', page.toString());
 params.append('limit', '20');
 
 if (searchQuery) params.append('search', searchQuery);
 if (filters.action) params.append('action', filters.action);
 if (filters.resource) params.append('resource', filters.resource);
 if (filters.userId) params.append('userId', filters.userId);
 if (filters.startDate) params.append('startDate', filters.startDate);
 if (filters.endDate) params.append('endDate', filters.endDate);
 
 const response = await fetch(`/api/audit-logs?${params}`);
 if (!response.ok) throw new Error('Failed to load audit logs');
 
 const data = await response.json();
 setLogs(data.logs);
 setTotalPages(Math.ceil(data.total / 20));
 } catch (error) {
 console.error('Failed to load audit logs:', error);
 toast.error('Failed to load activity logs');
 }
 }, [page, searchQuery, filters]);

 // Load statistics
 const loadStats = useCallback(async () => {
 try {
 const response = await fetch('/api/audit-logs/stats');
 if (!response.ok) throw new Error('Failed to load statistics');
 
 const data = await response.json();
 setStats(data);
 } catch (error) {
 console.error('Failed to load statistics:', error);
 toast.error('Failed to load activity statistics');
 }
 }, []);

 // Initial load
 useEffect(() => {
 const loadData = async () => {
 setLoading(true);
 await Promise.all([loadLogs(), loadStats()]);
 setLoading(false);
 };
 loadData();
 }, [loadLogs, loadStats]);

 // Refresh data
 const handleRefresh = async () => {
 setRefreshing(true);
 await Promise.all([loadLogs(), loadStats()]);
 setRefreshing(false);
 toast.success('Activity data refreshed');
 };

 // Export logs
 const handleExport = async (format: 'csv' | 'json') => {
 try {
 const params = new URLSearchParams();
 params.append('format', format);
 
 if (searchQuery) params.append('search', searchQuery);
 if (filters.action) params.append('action', filters.action);
 if (filters.resource) params.append('resource', filters.resource);
 if (filters.userId) params.append('userId', filters.userId);
 if (filters.startDate) params.append('startDate', filters.startDate);
 if (filters.endDate) params.append('endDate', filters.endDate);
 
 const response = await fetch(`/api/audit-logs/export?${params}`);
 if (!response.ok) throw new Error('Failed to export logs');
 
 const blob = await response.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `audit-logs-${Date.now()}.${format}`;
 a.click();
 URL.revokeObjectURL(url);
 
 toast.success(`Exported logs as ${format.toUpperCase()}`);
 } catch (error) {
 console.error('Failed to export logs:', error);
 toast.error('Failed to export logs');
 }
 };

 // Get action color
 const getActionColor = (action: string) => {
 return ACTION_COLORS[action.toLowerCase()] || ACTION_COLORS.default;
 };

 // Get resource icon
 const getResourceIcon = (resource: string) => {
 return RESOURCE_ICONS[resource.toLowerCase()] || RESOURCE_ICONS.default;
 };

 // Format user agent
 const formatUserAgent = (userAgent?: string) => {
 if (!userAgent) return 'Unknown';
 
 // Extract browser and OS info
 const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)[/\s](\d+)/);
 const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
 
 const browser = browserMatch ? `${browserMatch[1]} ${browserMatch[2]}` : 'Unknown Browser';
 const os = osMatch ? osMatch[1] : 'Unknown OS';
 
 return `${browser} on ${os}`;
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
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Activity Log
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Monitor all platform activities and user actions
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-2 rounded-md flex items-center gap-2 ${
 showFilters 
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
 : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
 }`}
 >
 <Filter className="w-4 h-4" />
 Filters
 </button>
 <button
 onClick={handleRefresh}
 disabled={refreshing}
 className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-750"
 >
 <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
 Refresh
 </button>
 <div className="relative">
 <button
 onClick={() => {
 const menu = document.getElementById('export-menu');
 if (menu) menu.classList.toggle('hidden');
 }}
 className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
 >
 <Download className="w-4 h-4" />
 Export
 </button>
 <div
 id="export-menu"
 className="hidden absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10"
 >
 <button
 onClick={() => handleExport('csv')}
 className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 Export CSV
 </button>
 <button
 onClick={() => handleExport('json')}
 className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 Export JSON
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Statistics */}
 {stats && (
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Today</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {stats.todayCount}
 </p>
 </div>
 <TrendingUp className="w-8 h-8 text-green-500" />
 </div>
 <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
 {stats.todayCount > stats.yesterdayCount ? '+' : ''}{Math.round(((stats.todayCount - stats.yesterdayCount) / stats.yesterdayCount) * 100)}% from yesterday
 </p>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">This Week</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {stats.weekCount}
 </p>
 </div>
 <Calendar className="w-8 h-8 text-blue-500" />
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">This Month</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {stats.monthCount}
 </p>
 </div>
 <Activity className="w-8 h-8 text-purple-500" />
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {stats.topUsers.length}
 </p>
 </div>
 <Users className="w-8 h-8 text-orange-500" />
 </div>
 </div>
 </div>
 )}

 {/* Charts */}
 {stats && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
 {/* Activity Over Time */}
 <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Activity Over Time
 </h3>
 <ResponsiveContainer width="100%" height={300}>
 <LineChart data={stats.activityByHour}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
 <XAxis dataKey="hour" stroke="#9CA3AF" />
 <YAxis stroke="#9CA3AF" />
 <Tooltip 
 contentStyle={{ 
 backgroundColor: '#1F2937', 
 border: '1px solid #374151',
 borderRadius: '0.375rem'
 }}
 labelStyle={{ color: '#F3F4F6' }}
 />
 <Line 
 type="monotone" 
 dataKey="count" 
 stroke="#3B82F6" 
 strokeWidth={2}
 dot={{ fill: '#3B82F6' }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>

 {/* Top Actions */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Top Actions
 </h3>
 <ResponsiveContainer width="100%" height={300}>
 <PieChart>
 <Pie
 data={stats.topActions.slice(0, 5)}
 dataKey="count"
 nameKey="action"
 cx="50%"
 cy="50%"
 outerRadius={80}
 label={({ action, percent }) => `${action} ${(percent * 100).toFixed(0)}%`}
 >
 {stats.topActions.slice(0, 5).map((entry, index) => (
 <Cell key={`cell-${index}`} fill={getActionColor(entry.action)} />
 ))}
 </Pie>
 <Tooltip 
 contentStyle={{ 
 backgroundColor: '#1F2937', 
 border: '1px solid #374151',
 borderRadius: '0.375rem'
 }}
 labelStyle={{ color: '#F3F4F6' }}
 />
 </PieChart>
 </ResponsiveContainer>
 </div>

 {/* Top Resources */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Top Resources
 </h3>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={stats.topResources.slice(0, 5)}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
 <XAxis dataKey="resource" stroke="#9CA3AF" />
 <YAxis stroke="#9CA3AF" />
 <Tooltip 
 contentStyle={{ 
 backgroundColor: '#1F2937', 
 border: '1px solid #374151',
 borderRadius: '0.375rem'
 }}
 labelStyle={{ color: '#F3F4F6' }}
 />
 <Bar dataKey="count" fill="#8B5CF6" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}

 {/* Filters */}
 {showFilters && (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
 <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Action
 </label>
 <select
 value={filters.action}
 onChange={(e) => setFilters({ ...filters, action: e.target.value })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Actions</option>
 <option value="create">Create</option>
 <option value="update">Update</option>
 <option value="delete">Delete</option>
 <option value="view">View</option>
 <option value="login">Login</option>
 <option value="logout">Logout</option>
 </select>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Resource
 </label>
 <select
 value={filters.resource}
 onChange={(e) => setFilters({ ...filters, resource: e.target.value })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Resources</option>
 <option value="service">Service</option>
 <option value="user">User</option>
 <option value="template">Template</option>
 <option value="settings">Settings</option>
 </select>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 User
 </label>
 <input
 type="text"
 value={filters.userId}
 onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
 placeholder="User ID or name"
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 Start Date
 </label>
 <input
 type="date"
 value={filters.startDate}
 onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
 End Date
 </label>
 <input
 type="date"
 value={filters.endDate}
 onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </div>
 
 <div className="flex justify-end mt-4">
 <button
 onClick={() => {
 setFilters({
 action: '',
 resource: '',
 userId: '',
 startDate: '',
 endDate: ''
 });
 setPage(1);
 }}
 className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 Clear Filters
 </button>
 </div>
 </div>
 )}

 {/* Search */}
 <div className="relative mb-6">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
 <input
 type="text"
 placeholder="Search logs..."
 value={searchQuery}
 onChange={(e) => {
 setSearchQuery(e.target.value);
 setPage(1);
 }}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 {/* Logs Table */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
 <table className="w-full">
 <thead className="bg-gray-50 dark:bg-gray-700">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Timestamp
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 User
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Action
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Resource
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 IP Address
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
 Details
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
 {logs.map((log) => (
 <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
 <div>
 <div>{new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
 <div className="text-xs text-gray-500">
 {getRelativeTimeString(new Date(log.timestamp))}
 </div>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
 <div className="flex items-center">
 <User className="w-4 h-4 mr-2 text-gray-400" />
 <div>
 <div>{log.userName || 'Anonymous'}</div>
 {log.userId && (
 <div className="text-xs text-gray-500">{log.userId}</div>
 )}
 </div>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm">
 <span
 className="px-2 py-1 text-xs rounded-full font-medium"
 style={{
 backgroundColor: `${getActionColor(log.action)}20`,
 color: getActionColor(log.action)
 }}
 >
 {log.action}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
 <div className="flex items-center">
 {getResourceIcon(log.resource)}
 <span className="ml-2">{log.resource}</span>
 {log.resourceId && (
 <span className="ml-1 text-xs text-gray-500">({log.resourceId})</span>
 )}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
 {log.ipAddress || 'Unknown'}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
 <button
 onClick={() => setSelectedLog(log)}
 className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 <Eye className="w-4 h-4" />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between mt-6">
 <div className="text-sm text-gray-600 dark:text-gray-400">
 Page {page} of {totalPages}
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page === 1}
 className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
 >
 Previous
 </button>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
 >
 Next
 </button>
 </div>
 </div>
 )}

 {/* Log Details Modal */}
 {selectedLog && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
 <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Log Details
 </h3>
 </div>
 <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
 <dl className="space-y-4">
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</dt>
 <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">
 {selectedLog.id}
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</dt>
 <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
 {new Date(selectedLog.timestamp).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User</dt>
 <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
 {selectedLog.userName || 'Anonymous'} 
 {selectedLog.userId && ` (${selectedLog.userId})`}
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Action</dt>
 <dd className="mt-1">
 <span
 className="px-2 py-1 text-xs rounded-full font-medium"
 style={{
 backgroundColor: `${getActionColor(selectedLog.action)}20`,
 color: getActionColor(selectedLog.action)
 }}
 >
 {selectedLog.action}
 </span>
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Resource</dt>
 <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
 {selectedLog.resource}
 {selectedLog.resourceId && ` (${selectedLog.resourceId})`}
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">IP Address</dt>
 <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
 {selectedLog.ipAddress || 'Unknown'}
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User Agent</dt>
 <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
 {formatUserAgent(selectedLog.userAgent)}
 </dd>
 </div>
 {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
 <div>
 <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Metadata</dt>
 <dd className="mt-1">
 <pre className="text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 p-3 rounded-md overflow-x-auto">
 {JSON.stringify(selectedLog.metadata, null, 2)}
 </pre>
 </dd>
 </div>
 )}
 </dl>
 </div>
 <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
 <button
 onClick={() => setSelectedLog(null)}
 className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}