'use client';

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { FixedSizeVirtualList } from '@/components/ui/VirtualList';
import { 
 Bell, Info, AlertTriangle, XCircle, CheckCircle, 
 Eye, Archive, Trash2, Pin, X, Clock, Tag, 
 ArrowRight, MessageCircle, ExternalLink, AlertCircle 
} from 'lucide-react';
import type { EnhancedNotification } from '@/services/notifications';

interface VirtualizedNotificationsProps {
 notifications: EnhancedNotification[];
 onNotificationClick: (notification: EnhancedNotification) => void;
 onActionClick: (notification: EnhancedNotification, action: any) => void;
 markAsRead: (id: string) => void;
 togglePin: (id: string) => void;
 deleteNotification: (id: string) => void;
 emptyMessage?: string;
}

export const VirtualizedNotifications = React.memo(({
 notifications,
 onNotificationClick,
 onActionClick,
 markAsRead,
 togglePin,
 deleteNotification,
 emptyMessage = "No notifications to display",
}: VirtualizedNotificationsProps) => {
 const getNotificationIcon = (type: string) => {
 switch (type) {
 case 'error':
 return <XCircle className="w-5 h-5 text-red-500" />;
 case 'warning':
 return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
 case 'success':
 return <CheckCircle className="w-5 h-5 text-green-500" />;
 case 'mention':
 return <MessageCircle className="w-5 h-5 text-blue-500" />;
 default:
 return <Info className="w-5 h-5 text-gray-500" />;
 }
 };

 const getTimeAgo = (timestamp: string | Date) => {
 const now = new Date();
 const notificationTime = new Date(timestamp);
 const diffInMs = now.getTime() - notificationTime.getTime();
 const diffInMinutes = Math.floor(diffInMs / 60000);
 const diffInHours = Math.floor(diffInMinutes / 60);
 const diffInDays = Math.floor(diffInHours / 24);

 if (diffInMinutes < 1) return 'Just now';
 if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
 if (diffInHours < 24) return `${diffInHours}h ago`;
 if (diffInDays < 7) return `${diffInDays}d ago`;
 return notificationTime.toLocaleDateString();
 };

 const renderNotification = useCallback((notification: EnhancedNotification, index: number) => {
 return (
 <div
 className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer border-b border-gray-200 dark:border-gray-700 ${
 !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
 } ${notification.pinned ? 'border-l-4 border-l-blue-500' : ''}`}
 onClick={() => onNotificationClick(notification)}
 >
 <div className="flex items-start gap-3">
 {/* Icon */}
 <div className="flex-shrink-0 mt-0.5">
 {getNotificationIcon(notification.type)}
 </div>
 
 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1">
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {notification.title}
 </p>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 {notification.message}
 </p>
 
 {/* Tags */}
 {notification.tags && notification.tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-2">
 {notification.tags.map((tag, idx) => (
 <span
 key={idx}
 className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
 >
 <Tag className="w-3 h-3 mr-1" />
 {tag}
 </span>
 ))}
 </div>
 )}
 
 {/* Actions */}
 {notification.actions && notification.actions.length > 0 && (
 <div className="flex items-center gap-2 mt-3">
 {notification.actions.map((action, idx) => (
 <button
 key={idx}
 onClick={(e) => {
 e.stopPropagation();
 onActionClick(notification, action);
 }}
 className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors ${
 action.primary
 ? 'bg-blue-600 text-white hover:bg-blue-700'
 : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
 }`}
 >
 {action.icon && <span className="mr-1">{action.icon}</span>}
 {action.label}
 {action.url && <ExternalLink className="w-3 h-3 ml-1" />}
 </button>
 ))}
 </div>
 )}
 </div>
 
 {/* Time */}
 <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
 <div className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 {getTimeAgo(notification.timestamp)}
 </div>
 </div>
 </div>
 </div>
 
 {/* Actions Menu */}
 <div className="flex-shrink-0">
 <div className="flex items-center gap-1">
 {!notification.read && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 markAsRead(notification.id);
 }}
 className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
 title="Mark as read"
 >
 <Eye className="w-4 h-4" />
 </button>
 )}
 
 <button
 onClick={(e) => {
 e.stopPropagation();
 togglePin(notification.id);
 }}
 className={`p-1 rounded ${
 notification.pinned
 ? 'text-blue-600 hover:text-blue-700'
 : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
 }`}
 title={notification.pinned ? 'Unpin' : 'Pin'}
 >
 <Pin className="w-4 h-4" />
 </button>
 
 <button
 onClick={(e) => {
 e.stopPropagation();
 deleteNotification(notification.id);
 }}
 className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
 title="Delete"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 }, [onNotificationClick, onActionClick, markAsRead, togglePin, deleteNotification]);

 const emptyState = (
 <div className="flex flex-col items-center justify-center h-64 text-center p-4">
 <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
 <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
 </div>
 );

 return (
 <div className="h-[500px] overflow-hidden">
 <FixedSizeVirtualList
 items={notifications}
 renderItem={renderNotification}
 itemSize={120} // Estimated height of notification item
 emptyState={emptyState}
 overscan={3}
 />
 </div>
 );
});

VirtualizedNotifications.displayName = 'VirtualizedNotifications';