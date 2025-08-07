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
 Bell,
 X,
 AlertCircle,
 Info,
 CheckCircle,
 AlertTriangle,
 Clock,
 Settings,
 Search,
 Archive,
 Trash2,
 Pin,
 User,
 ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export interface Notification {
 id: string;
 type: 'info' | 'success' | 'warning' | 'error' | 'alert' | 'mention' | 'deployment' | 'system';
 title: string;
 message: string;
 timestamp: string;
 read: boolean;
 pinned: boolean;
 archived: boolean;
 priority: 'low' | 'medium' | 'high' | 'urgent';
 source: {
 name: string;
 type: 'service' | 'system' | 'user' | 'automation';
 };
 actions?: Array<{
 id: string;
 label: string;
 type: 'primary' | 'secondary' | 'danger';
 url?: string;
 action?: () => void;
 }>;
 metadata?: {
 entityRef?: string;
 environment?: string;
 tags?: string[];
 [key: string]: any;
 };
}

interface NotificationCenterProps {
 isOpen: boolean;
 onClose: () => void;
 maxHeight?: string;
}

export default function NotificationCenter({ 
 isOpen, 
 onClose, 
 maxHeight = 'h-96' 
}: NotificationCenterProps) {
 const router = useRouter();
 
 // State
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'pinned' | 'archived'>('all');
 const [selectedType, setSelectedType] = useState<string>('all');
 const [_selectedNotifications, _setSelectedNotifications] = useState<string[]>([]);
 const [showSettings, setShowSettings] = useState(false);

 // Load notifications
 const loadNotifications = useCallback(async () => {
 try {
 setLoading(true);
 
 const params = new URLSearchParams({
 limit: '10', // Limit for dropdown
 filter: selectedFilter,
 ...(selectedType !== 'all' && { type: selectedType }),
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
 }, [selectedFilter, selectedType, searchQuery]);

 // Apply filters and search
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

 // Sort by priority and timestamp
 filtered.sort((a, b) => {
 const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
 const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
 if (priorityDiff !== 0) return priorityDiff;
 
 return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
 });

 setFilteredNotifications(filtered);
 }, [notifications, searchQuery, selectedFilter, selectedType]);

 // Initial load
 useEffect(() => {
 if (isOpen) {
 loadNotifications();
 }
 }, [isOpen, loadNotifications]);

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

 const markAllAsRead = async () => {
 try {
 const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
 if (unreadIds.length === 0) return;

 const response = await fetch('/api/notifications/bulk', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: 'mark_read',
 notificationIds: unreadIds
 })
 });

 if (!response.ok) {
 throw new Error('Failed to mark all as read');
 }

 setNotifications(prev => prev.map(n => ({ ...n, read: true })));
 toast.success('All notifications marked as read');
 } catch (error) {
 console.error('Failed to mark all as read:', error);
 toast.error('Failed to mark all as read');
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

 const handleAction = (action: any, _notification: Notification) => {
 if (action.url) {
 router.push(action.url);
 onClose();
 } else if (action.action) {
 action.action();
 }
 };

 const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: -20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: -20 }}
 className="fixed top-16 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50"
 >
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-3">
 <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Notifications
 </h3>
 {unreadCount > 0 && (
 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
 {unreadCount}
 </span>
 )}
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={() => {
 router.push('/notifications/settings');
 onClose();
 }}
 className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
 title="Notification Settings"
 >
 <Settings className="w-4 h-4" />
 </button>
 
 <button
 onClick={onClose}
 className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Search and Filters */}
 <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
 {/* Search */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search notifications..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 {/* Filters */}
 <div className="flex gap-2">
 <select
 value={selectedFilter}
 onChange={(e) => setSelectedFilter(e.target.value as any)}
 className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="all">All</option>
 <option value="unread">Unread</option>
 <option value="pinned">Pinned</option>
 <option value="archived">Archived</option>
 </select>
 
 <select
 value={selectedType}
 onChange={(e) => setSelectedType(e.target.value)}
 className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="all">All Types</option>
 <option value="error">Errors</option>
 <option value="warning">Warnings</option>
 <option value="success">Success</option>
 <option value="info">Info</option>
 <option value="mention">Mentions</option>
 </select>
 </div>
 
 {unreadCount > 0 && (
 <button
 onClick={markAllAsRead}
 className="w-full text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 py-2 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/30"
 >
 Mark all as read
 </button>
 )}
 </div>

 {/* Notifications List */}
 <div className={`${maxHeight} overflow-y-auto`}>
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
 </div>
 ) : filteredNotifications.length === 0 ? (
 <div className="text-center py-8">
 <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
 <p className="text-gray-500 dark:text-gray-400 text-sm">
 {searchQuery || selectedFilter !== 'all' || selectedType !== 'all'
 ? 'No notifications match your filters'
 : 'No notifications yet'
 }
 </p>
 </div>
 ) : (
 <div className="divide-y divide-gray-200 dark:divide-gray-700">
 {filteredNotifications.map((notification, index) => (
 <motion.div
 key={notification.id}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.05 }}
 className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
 !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
 } ${notification.pinned ? 'border-l-4 border-blue-500' : ''}`}
 >
 <div className="flex items-start gap-3">
 {/* Icon */}
 <div className="flex-shrink-0 mt-0.5">
 {getNotificationIcon(notification.type)}
 </div>
 
 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between mb-1">
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {notification.title}
 </p>
 
 <div className="flex items-center gap-1 ml-2">
 <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
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
 <Pin className="w-3 h-3" />
 </button>
 </div>
 </div>
 
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
 {notification.message}
 </p>
 
 {/* Metadata */}
 <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
 <span className="flex items-center gap-1">
 <User className="w-3 h-3" />
 {notification.source.name}
 </span>
 <span className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 {getRelativeTimeString(new Date(notification.timestamp))}
 </span>
 </div>
 
 {/* Actions */}
 {notification.actions && notification.actions.length > 0 && (
 <div className="flex gap-2 mb-2">
 {notification.actions.map(action => (
 <button
 key={action.id}
 onClick={() => handleAction(action, notification)}
 className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
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
 )}
 
 {/* Quick Actions */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {!notification.read && (
 <button
 onClick={() => markAsRead(notification.id)}
 className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 Mark as read
 </button>
 )}
 </div>
 
 <div className="flex items-center gap-1">
 <button
 onClick={() => archiveNotification(notification.id)}
 className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
 title="Archive"
 >
 <Archive className="w-3 h-3" />
 </button>
 
 <button
 onClick={() => deleteNotification(notification.id)}
 className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
 title="Delete"
 >
 <Trash2 className="w-3 h-3" />
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
 <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
 <button
 onClick={() => {
 router.push('/notifications');
 onClose();
 }}
 className="w-full text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-center"
 >
 View all notifications 
 </button>
 </div>
 </motion.div>
 </AnimatePresence>
 );
}