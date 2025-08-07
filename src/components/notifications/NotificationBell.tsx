'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import NotificationCenter from './NotificationCenter';
import { notificationService } from '@/services/notifications/notification-service';

export default function NotificationBell() {
 const [isOpen, setIsOpen] = useState(false);
 const [unreadCount, setUnreadCount] = useState(0);
 const [isConnected, setIsConnected] = useState(false);

 useEffect(() => {
 // Connect to WebSocket
 notificationService.connect();

 // Update unread count
 const updateUnreadCount = () => {
 setUnreadCount(notificationService.getUnreadCount());
 };

 // Subscribe to events
 const handleConnected = () => {
 setIsConnected(true);
 console.log('Notification service connected');
 };

 const handleDisconnected = () => {
 setIsConnected(false);
 console.log('Notification service disconnected');
 };

 const handleNewNotification = () => {
 updateUnreadCount();
 // Could also show a toast notification here
 };

 const handleNotificationRead = () => {
 updateUnreadCount();
 };

 notificationService.on('connected', handleConnected);
 notificationService.on('disconnected', handleDisconnected);
 notificationService.on('new_notification', handleNewNotification);
 notificationService.on('notification_read', handleNotificationRead);
 notificationService.on('all_notifications_read', updateUnreadCount);
 notificationService.on('notification_cleared', updateUnreadCount);
 notificationService.on('all_notifications_cleared', updateUnreadCount);

 // Initial update
 updateUnreadCount();

 // Subscribe to catalog updates
 notificationService.subscribeToCatalog();

 return () => {
 notificationService.off('connected', handleConnected);
 notificationService.off('disconnected', handleDisconnected);
 notificationService.off('new_notification', handleNewNotification);
 notificationService.off('notification_read', handleNotificationRead);
 notificationService.off('all_notifications_read', updateUnreadCount);
 notificationService.off('notification_cleared', updateUnreadCount);
 notificationService.off('all_notifications_cleared', updateUnreadCount);

 // Disconnect when component unmounts
 notificationService.disconnect();
 };
 }, []);

 return (
 <>
 <Button
 variant="ghost"
 size="icon"
 className="relative"
 onClick={() => setIsOpen(!isOpen)}
 >
 <Bell className="h-5 w-5" />
 {unreadCount > 0 && (
 <Badge
 variant="destructive"
 className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
 >
 {unreadCount > 99 ? '99+' : unreadCount}
 </Badge>
 )}
 {isConnected && (
 <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full" />
 )}
 </Button>

 <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
 </>
 );
}