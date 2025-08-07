'use client';

import React, { useState, useEffect } from 'react';
import {
 AlertTriangle,
 XCircle,
 Bell,
 CheckCircle2,
 Clock,
 X,
 ExternalLink,
 ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SoundcheckAlert {
 id: string;
 serviceId: string;
 serviceName: string;
 severity: 'critical' | 'high' | 'medium' | 'low';
 title: string;
 description: string;
 category: string;
 timestamp: Date;
 acknowledged: boolean;
 resolved: boolean;
 checkId?: string;
 actions?: {
 label: string;
 href: string;
 type: 'primary' | 'secondary';
 }[];
}

export function SoundcheckNotifications() {
 const [alerts, setAlerts] = useState<SoundcheckAlert[]>([]);
 const [isOpen, setIsOpen] = useState(false);
 const [unreadCount, setUnreadCount] = useState(0);

 // Mock alerts - in real app, this would come from WebSocket or polling
 useEffect(() => {
 const mockAlerts: SoundcheckAlert[] = [
 {
 id: 'alert-1',
 serviceId: 'payment-api',
 serviceName: 'Payment API',
 severity: 'critical',
 title: 'Critical Security Vulnerability Detected',
 description: 'API endpoints are missing authentication checks',
 category: 'security',
 timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
 acknowledged: false,
 resolved: false,
 checkId: 'sec-001',
 actions: [
 { label: 'View Details', href: '/soundcheck/payment-api', type: 'primary' },
 { label: 'Run Fix', href: '#', type: 'secondary' }
 ]
 },
 {
 id: 'alert-2',
 serviceId: 'user-service',
 serviceName: 'User Service',
 severity: 'high',
 title: 'Test Coverage Below Threshold',
 description: 'Code coverage dropped to 65%, below the required 80%',
 category: 'testing',
 timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
 acknowledged: false,
 resolved: false,
 checkId: 'test-001',
 actions: [
 { label: 'View Report', href: '/soundcheck/user-service', type: 'primary' }
 ]
 },
 {
 id: 'alert-3',
 serviceId: 'notification-service',
 serviceName: 'Notification Service',
 severity: 'medium',
 title: 'Documentation Outdated',
 description: 'API documentation has not been updated in 30 days',
 category: 'documentation',
 timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
 acknowledged: true,
 resolved: false,
 actions: [
 { label: 'Update Docs', href: '#', type: 'primary' }
 ]
 }
 ];

 setAlerts(mockAlerts);
 setUnreadCount(mockAlerts.filter(alert => !alert.acknowledged && !alert.resolved).length);
 }, []);

 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case 'critical':
 return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
 case 'high':
 return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
 case 'medium':
 return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
 case 'low':
 return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
 default:
 return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
 }
 };

 const getSeverityIcon = (severity: string) => {
 switch (severity) {
 case 'critical':
 return <XCircle className="h-4 w-4 text-red-600" />;
 case 'high':
 return <AlertTriangle className="h-4 w-4 text-orange-600" />;
 case 'medium':
 return <Clock className="h-4 w-4 text-yellow-600" />;
 case 'low':
 return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
 default:
 return <Bell className="h-4 w-4 text-gray-600" />;
 }
 };

 const handleAcknowledge = (alertId: string) => {
 setAlerts(prev => prev.map(alert => 
 alert.id === alertId ? { ...alert, acknowledged: true } : alert
 ));
 setUnreadCount(prev => Math.max(0, prev - 1));
 };

 const handleResolve = (alertId: string) => {
 setAlerts(prev => prev.map(alert => 
 alert.id === alertId ? { ...alert, resolved: true, acknowledged: true } : alert
 ));
 setUnreadCount(prev => Math.max(0, prev - 1));
 };

 const formatTimeAgo = (date: Date) => {
 const now = new Date();
 const diffInMs = now.getTime() - date.getTime();
 const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
 const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

 if (diffInMinutes < 1) return 'just now';
 if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
 if (diffInHours < 24) return `${diffInHours}h ago`;
 return date.toLocaleDateString();
 };

 const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' && !alert.resolved);
 const activeAlerts = alerts.filter(alert => !alert.resolved);

 return (
 <Popover open={isOpen} onOpenChange={setIsOpen}>
 <PopoverTrigger asChild>
 <Button 
 variant="ghost" 
 size="icon" 
 className="relative"
 aria-label={`${unreadCount} unread notifications`}
 >
 <Bell className="h-5 w-5" />
 {unreadCount > 0 && (
 <Badge 
 className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-red-600 text-white"
 >
 {unreadCount > 9 ? '9+' : unreadCount}
 </Badge>
 )}
 </Button>
 </PopoverTrigger>
 
 <PopoverContent className="w-96 p-0" align="end">
 <div className="p-4 border-b">
 <div className="flex items-center justify-between">
 <h3 className="font-semibold">Quality Alerts</h3>
 <div className="flex items-center gap-2">
 {criticalAlerts.length > 0 && (
 <Badge variant="destructive" className="text-xs">
 {criticalAlerts.length} critical
 </Badge>
 )}
 <Button
 variant="ghost"
 size="icon"
 className="h-6 w-6"
 onClick={() => setIsOpen(false)}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 </div>
 {activeAlerts.length > 0 && (
 <p className="text-sm text-muted-foreground mt-1">
 {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}
 </p>
 )}
 </div>

 <div className="max-h-96 overflow-y-auto">
 {activeAlerts.length === 0 ? (
 <div className="p-6 text-center">
 <CheckCircle2 className="h-8 w-8 text-success-600 mx-auto mb-2" />
 <p className="text-sm font-medium">All clear!</p>
 <p className="text-xs text-muted-foreground">No active quality alerts</p>
 </div>
 ) : (
 <div className="space-y-1 p-2">
 {activeAlerts.map((alert) => (
 <Card 
 key={alert.id} 
 className={cn(
 "border-l-4 p-3 hover:bg-muted/50 transition-colors",
 alert.severity === 'critical' && "border-l-red-500",
 alert.severity === 'high' && "border-l-orange-500",
 alert.severity === 'medium' && "border-l-yellow-500",
 alert.severity === 'low' && "border-l-blue-500",
 !alert.acknowledged && "bg-muted/30"
 )}
 >
 <CardHeader className="p-0 pb-2">
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-start gap-2 flex-1">
 {getSeverityIcon(alert.severity)}
 <div className="min-w-0 flex-1">
 <CardTitle className="text-sm leading-tight">
 {alert.title}
 </CardTitle>
 <CardDescription className="text-xs mt-1">
 {alert.serviceName} • {formatTimeAgo(alert.timestamp)}
 </CardDescription>
 </div>
 </div>
 <Badge 
 className={cn("text-xs capitalize", getSeverityColor(alert.severity))}
 >
 {alert.severity}
 </Badge>
 </div>
 </CardHeader>
 
 <CardContent className="p-0">
 <p className="text-xs text-muted-foreground mb-3">
 {alert.description}
 </p>
 
 <div className="flex items-center justify-between">
 <div className="flex gap-1">
 {alert.actions?.map((action, index) => (
 <Button
 key={index}
 size="sm"
 variant={action.type === 'primary' ? 'default' : 'outline'}
 className="h-6 text-xs px-2"
 asChild
 >
 <a href={action.href} className="flex items-center gap-1">
 {action.label}
 {action.href.startsWith('http') && (
 <ExternalLink className="h-3 w-3" />
 )}
 </a>
 </Button>
 ))}
 </div>
 
 <div className="flex gap-1">
 {!alert.acknowledged && (
 <Button
 size="sm"
 variant="ghost"
 className="h-6 text-xs px-2"
 onClick={() => handleAcknowledge(alert.id)}
 >
 Ack
 </Button>
 )}
 <Button
 size="sm"
 variant="ghost"
 className="h-6 text-xs px-2"
 onClick={() => handleResolve(alert.id)}
 >
 Resolve
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>

 {activeAlerts.length > 0 && (
 <div className="p-4 border-t">
 <Button variant="outline" size="sm" className="w-full" asChild>
 <a href="/soundcheck" className="flex items-center justify-center gap-2">
 View All Alerts
 <ArrowRight className="h-3 w-3" />
 </a>
 </Button>
 </div>
 )}
 </PopoverContent>
 </Popover>
 );
}