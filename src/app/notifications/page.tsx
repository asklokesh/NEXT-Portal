'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

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
import { motion } from 'framer-motion';
import {
 Bell,
 Settings,
 Archive,
 Trash2,
 Filter,
 Search,
 Check,
 CheckCheck,
 Pin,
 AlertCircle,
 Info,
 CheckCircle,
 AlertTriangle,
 Clock,
 User,
 Calendar,
 Tag,
 ExternalLink,
 Eye,
 EyeOff,
 Download,
 Upload
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import type { Notification } from '@/components/notifications/NotificationCenter';

const NotificationsPage = () => {
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'pinned' | 'archived'>('all');
 const [selectedType, setSelectedType] = useState<string>('all');
 const [selectedPriority, setSelectedPriority] = useState<string>('all');
 const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
 const [bulkAction, setBulkAction] = useState<string>('');

 // Load notifications
 useEffect(() => {
 const loadNotifications = async () => {
 try {
 setLoading(true);
 
 const params = new URLSearchParams({
 filter: selectedFilter,
 ...(selectedType !== 'all' && { type: selectedType }),
 ...(selectedPriority !== 'all' && { priority: selectedPriority }),
 ...(searchQuery && { search: searchQuery })
 });

 const response = await fetch(`/api/notifications?${params}`);
 if (!response.ok) {
 throw new Error('Failed to fetch notifications');
 }

 const data = await response.json();
 setNotifications(data.notifications || []);
 } catch (error) {
 console.error('Failed to load notifications:', error);
 toast.error('Failed to load notifications');
 } finally {
 setLoading(false);
 }
 };

 void loadNotifications();
 }, [selectedFilter, selectedType, selectedPriority, searchQuery]);

 // Apply filters
 useEffect(() => {
 let filtered = [...notifications];

 // Search filter
 if (searchQuery.trim()) {
 const query = searchQuery.toLowerCase();
 filtered = filtered.filter(notification =>
 notification.title.toLowerCase().includes(query) ||
 notification.message.toLowerCase().includes(query) ||
 notification.source.name.toLowerCase().includes(query)
 );
 }

 // Status filter
 switch (selectedFilter) {
 case 'unread':
 filtered = filtered.filter(n => !n.read);
 break;
 case 'pinned':
 filtered = filtered.filter(n => n.pinned);
 break;
 case 'archived':
 filtered = filtered.filter(n => n.archived);
 break;
 default:
 filtered = filtered.filter(n => !n.archived);
 }

 // Type filter
 if (selectedType !== 'all') {
 filtered = filtered.filter(n => n.type === selectedType);
 }

 // Priority filter
 if (selectedPriority !== 'all') {
 filtered = filtered.filter(n => n.priority === selectedPriority);
 }

 // Sort by priority and timestamp
 filtered.sort((a, b) => {
 const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
 const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
 if (priorityDiff !== 0) return priorityDiff;
 
 return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
 });

 setFilteredNotifications(filtered);
 }, [notifications, searchQuery, selectedFilter, selectedType, selectedPriority]);

 // Helper functions
 const getNotificationIcon = (type: string) => {
 const iconClass = "w-5 h-5";
 
 switch (type) {
 case 'error':
 return <AlertCircle className={`${iconClass} text-red-600`} />;
 case 'warning':
 return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
 case 'success':
 return <CheckCircle className={`${iconClass} text-green-600`} />;
 case 'info':
 return <Info className={`${iconClass} text-blue-600`} />;
 case 'mention':
 return <User className={`${iconClass} text-purple-600`} />;
 default:
 return <Bell className={`${iconClass} text-gray-600`} />;
 }
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
 case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
 case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
 default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
 }
 };

 const handleSelectNotification = (id: string) => {
 setSelectedNotifications(prev => 
 prev.includes(id) 
 ? prev.filter(n => n !== id)
 : [...prev, id]
 );
 };

 const handleSelectAll = () => {
 if (selectedNotifications.length === filteredNotifications.length) {
 setSelectedNotifications([]);
 } else {
 setSelectedNotifications(filteredNotifications.map(n => n.id));
 }
 };

 const handleBulkAction = async () => {
 if (!bulkAction || selectedNotifications.length === 0) return;

 try {
 const response = await fetch('/api/notifications/bulk', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: bulkAction.replace('-', '_'),
 notificationIds: selectedNotifications
 })
 });

 if (!response.ok) {
 throw new Error('Failed to process bulk action');
 }

 const result = await response.json();
 
 // Update local state
 switch (bulkAction) {
 case 'mark-read':
 setNotifications(prev => prev.map(n => 
 selectedNotifications.includes(n.id) ? { ...n, read: true } : n
 ));
 break;
 case 'mark-unread':
 setNotifications(prev => prev.map(n => 
 selectedNotifications.includes(n.id) ? { ...n, read: false } : n
 ));
 break;
 case 'archive':
 setNotifications(prev => prev.map(n => 
 selectedNotifications.includes(n.id) ? { ...n, archived: true } : n
 ));
 break;
 case 'delete':
 setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
 break;
 }

 toast.success(result.message);
 } catch (error) {
 console.error('Failed to process bulk action:', error);
 toast.error('Failed to process bulk action');
 }

 setSelectedNotifications([]);
 setBulkAction('');
 };

 const markAsRead = async (id: string) => {
 try {
 const response = await fetch(`/api/notifications?id=${id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'mark_read' })
 });

 if (!response.ok) {
 throw new Error('Failed to mark as read');
 }

 setNotifications(prev => prev.map(n => 
 n.id === id ? { ...n, read: true } : n
 ));
 } catch (error) {
 console.error('Failed to mark as read:', error);
 toast.error('Failed to mark as read');
 }
 };

 const togglePin = async (id: string) => {
 try {
 const notification = notifications.find(n => n.id === id);
 const action = notification?.pinned ? 'unpin' : 'pin';

 const response = await fetch(`/api/notifications?id=${id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action })
 });

 if (!response.ok) {
 throw new Error('Failed to toggle pin');
 }

 setNotifications(prev => prev.map(n => 
 n.id === id ? { ...n, pinned: !n.pinned } : n
 ));
 } catch (error) {
 console.error('Failed to toggle pin:', error);
 toast.error('Failed to toggle pin');
 }
 };

 const archiveNotification = async (id: string) => {
 try {
 const response = await fetch(`/api/notifications?id=${id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'archive' })
 });

 if (!response.ok) {
 throw new Error('Failed to archive');
 }

 setNotifications(prev => prev.map(n => 
 n.id === id ? { ...n, archived: true } : n
 ));
 toast.success('Notification archived');
 } catch (error) {
 console.error('Failed to archive:', error);
 toast.error('Failed to archive notification');
 }
 };

 const deleteNotification = async (id: string) => {
 try {
 const response = await fetch(`/api/notifications?id=${id}`, {
 method: 'DELETE'
 });

 if (!response.ok) {
 throw new Error('Failed to delete');
 }

 setNotifications(prev => prev.filter(n => n.id !== id));
 toast.success('Notification deleted');
 } catch (error) {
 console.error('Failed to delete:', error);
 toast.error('Failed to delete notification');
 }
 };

 const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Notifications
 </h1>
 <p className="text-gray-600 dark:text-gray-400 mt-1">
 Manage your platform notifications and alerts
 </p>
 </div>
 
 <div className="flex items-center gap-3">
 {unreadCount > 0 && (
 <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
 {unreadCount} unread
 </span>
 )}
 
 <button
 onClick={() => {/* Navigate to settings */}}
 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
 >
 <Settings className="w-4 h-4" />
 Settings
 </button>
 </div>
 </div>

 {/* Filters and Search */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
 {/* Search */}
 <div className="lg:col-span-2">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search notifications..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </div>
 
 {/* Status Filter */}
 <div>
 <select
 value={selectedFilter}
 onChange={(e) => setSelectedFilter(e.target.value as any)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="all">All</option>
 <option value="unread">Unread</option>
 <option value="pinned">Pinned</option>
 <option value="archived">Archived</option>
 </select>
 </div>
 
 {/* Type Filter */}
 <div>
 <select
 value={selectedType}
 onChange={(e) => setSelectedType(e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="all">All Types</option>
 <option value="error">Errors</option>
 <option value="warning">Warnings</option>
 <option value="success">Success</option>
 <option value="info">Info</option>
 <option value="mention">Mentions</option>
 <option value="system">System</option>
 </select>
 </div>
 
 {/* Priority Filter */}
 <div>
 <select
 value={selectedPriority}
 onChange={(e) => setSelectedPriority(e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="all">All Priorities</option>
 <option value="urgent">Urgent</option>
 <option value="high">High</option>
 <option value="medium">Medium</option>
 <option value="low">Low</option>
 </select>
 </div>
 </div>

 {/* Bulk Actions */}
 {selectedNotifications.length > 0 && (
 <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-4">
 <span className="text-sm text-gray-600 dark:text-gray-400">
 {selectedNotifications.length} selected
 </span>
 
 <select
 value={bulkAction}
 onChange={(e) => setBulkAction(e.target.value)}
 className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">Choose action...</option>
 <option value="mark-read">Mark as read</option>
 <option value="mark-unread">Mark as unread</option>
 <option value="archive">Archive</option>
 <option value="delete">Delete</option>
 </select>
 
 <button
 onClick={handleBulkAction}
 disabled={!bulkAction}
 className="px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Apply
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Notifications List */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 {/* Header */}
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
 onChange={handleSelectAll}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {filteredNotifications.length} notifications
 </span>
 </div>
 
 <div className="text-sm text-gray-500 dark:text-gray-400">
 {unreadCount} unread
 </div>
 </div>
 </div>

 {/* List */}
 <div className="divide-y divide-gray-200 dark:divide-gray-700">
 {loading ? (
 <div className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
 </div>
 ) : filteredNotifications.length === 0 ? (
 <div className="text-center py-12">
 <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No notifications found
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 {searchQuery || selectedFilter !== 'all' || selectedType !== 'all' || selectedPriority !== 'all'
 ? 'Try adjusting your filters or search terms'
 : 'No notifications yet'
 }
 </p>
 </div>
 ) : (
 filteredNotifications.map((notification, index) => (
 <motion.div
 key={notification.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.02 }}
 className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
 !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
 } ${notification.pinned ? 'border-l-4 border-blue-500' : ''}`}
 >
 <div className="flex items-start gap-4">
 {/* Checkbox */}
 <input
 type="checkbox"
 checked={selectedNotifications.includes(notification.id)}
 onChange={() => handleSelectNotification(notification.id)}
 className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 
 {/* Icon */}
 <div className="flex-shrink-0 mt-0.5">
 {getNotificationIcon(notification.type)}
 </div>
 
 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between mb-2">
 <div className="flex-1">
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
 {notification.title}
 </p>
 <p className="text-sm text-gray-600 dark:text-gray-300">
 {notification.message}
 </p>
 </div>
 
 <div className="flex items-center gap-2 ml-4">
 <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
 {notification.priority}
 </span>
 
 <button
 onClick={() => togglePin(notification.id)}
 className={`p-1 rounded transition-colors ${
 notification.pinned 
 ? 'text-blue-600 dark:text-blue-400' 
 : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
 }`}
 >
 <Pin className="w-4 h-4" />
 </button>
 </div>
 </div>
 
 {/* Metadata */}
 <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
 <span className="flex items-center gap-1">
 <User className="w-3 h-3" />
 {notification.source.name}
 </span>
 <span className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 {getRelativeTimeString(new Date(notification.timestamp))}
 </span>
 {notification.metadata?.environment && (
 <span className="flex items-center gap-1">
 <Tag className="w-3 h-3" />
 {notification.metadata.environment}
 </span>
 )}
 </div>
 
 {/* Actions */}
 <div className="flex items-center justify-between">
 <div className="flex gap-2">
 {notification.actions?.map(action => (
 <button
 key={action.id}
 onClick={() => {
 if (action.url) {
 window.open(action.url, '_blank');
 }
 }}
 className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
 action.type === 'primary'
 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30'
 : action.type === 'danger'
 ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30'
 : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
 }`}
 >
 {action.label}
 {action.url && <ExternalLink className="w-3 h-3 ml-1 inline" />}
 </button>
 ))}
 </div>
 
 <div className="flex items-center gap-1">
 {!notification.read && (
 <button
 onClick={() => markAsRead(notification.id)}
 className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
 title="Mark as read"
 >
 <Eye className="w-4 h-4" />
 </button>
 )}
 
 <button
 onClick={() => archiveNotification(notification.id)}
 className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 title="Archive"
 >
 <Archive className="w-4 h-4" />
 </button>
 
 <button
 onClick={() => deleteNotification(notification.id)}
 className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
 title="Delete"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 </div>
 </motion.div>
 ))
 )}
 </div>
 </div>
 </div>
 );
};

export default NotificationsPage;