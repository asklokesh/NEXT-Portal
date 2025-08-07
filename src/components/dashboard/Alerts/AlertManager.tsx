'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

import { 
 Bell, 
 AlertCircle, 
 CheckCircle, 
 X,
 Settings,
 Filter,
 Clock,
 TrendingUp,
 Plus,
 Search,
 AlertTriangle
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import type { Alert, AlertRule } from '../types';

interface AlertManagerProps {
 className?: string;
}

interface AlertItemProps {
 alert: Alert;
 onAcknowledge?: (alertId: string) => void;
 onResolve?: (alertId: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onAcknowledge, onResolve }) => {
 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case 'critical':
 return 'text-red-600 bg-red-50 border-red-200';
 case 'high':
 return 'text-orange-600 bg-orange-50 border-orange-200';
 case 'medium':
 return 'text-yellow-600 bg-yellow-50 border-yellow-200';
 case 'low':
 return 'text-blue-600 bg-blue-50 border-blue-200';
 default:
 return 'text-gray-600 bg-gray-50 border-gray-200';
 }
 };

 const getSeverityIcon = (severity: string) => {
 switch (severity) {
 case 'critical':
 return <AlertTriangle className="w-4 h-4" />;
 case 'high':
 case 'medium':
 return <AlertCircle className="w-4 h-4" />;
 default:
 return <Bell className="w-4 h-4" />;
 }
 };

 const formatTimeAgo = (date: Date) => {
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMins / 60);
 const diffDays = Math.floor(diffHours / 24);

 if (diffMins < 1) return 'just now';
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 return `${diffDays}d ago`;
 };

 return (
 <div className={cn(
 'p-4 rounded-lg border',
 alert.status === 'firing' ? 'bg-card' : 'bg-muted/30'
 )}>
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3 flex-1">
 <div className={cn(
 'p-1 rounded-full',
 getSeverityColor(alert.severity)
 )}>
 {getSeverityIcon(alert.severity)}
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium text-sm">{alert.message}</h4>
 <span className={cn(
 'px-2 py-0.5 text-xs font-medium rounded-full',
 getSeverityColor(alert.severity)
 )}>
 {alert.severity}
 </span>
 </div>
 
 <div className="text-xs text-muted-foreground space-y-1">
 <div>Value: {alert.value} (threshold: {alert.threshold})</div>
 <div>Started: {formatTimeAgo(alert.startTime)}</div>
 {alert.endTime && (
 <div>Resolved: {formatTimeAgo(alert.endTime)}</div>
 )}
 </div>

 {alert.annotations && Object.keys(alert.annotations).length > 0 && (
 <div className="mt-2 text-xs">
 {Object.entries(alert.annotations).map(([key, value]) => (
 <div key={key} className="text-muted-foreground">
 <span className="font-medium">{key}:</span> {value}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="flex items-center gap-1 ml-2">
 {alert.status === 'firing' && (
 <>
 <button
 onClick={() => onAcknowledge?.(alert.id)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Acknowledge"
 >
 <CheckCircle className="w-4 h-4" />
 </button>
 <button
 onClick={() => onResolve?.(alert.id)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Resolve"
 >
 <X className="w-4 h-4" />
 </button>
 </>
 )}
 </div>
 </div>
 </div>
 );
};

export const AlertManager: React.FC<AlertManagerProps> = ({ className }) => {
 const [alerts, setAlerts] = useState<Alert[]>([]);
 const [filter, setFilter] = useState<'all' | 'firing' | 'resolved'>('all');
 const [severityFilter, setSeverityFilter] = useState<string>('all');
 const [searchTerm, setSearchTerm] = useState('');
 const [showRules, setShowRules] = useState(false);

 // Mock alerts data
 useEffect(() => {
 const mockAlerts: Alert[] = [
 {
 id: 'alert-1',
 ruleId: 'rule-1',
 dashboardId: 'dashboard-1',
 widgetId: 'widget-1',
 status: 'firing',
 severity: 'critical',
 message: 'High error rate detected in payment service',
 value: 15.5,
 threshold: 5,
 startTime: new Date(Date.now() - 900000),
 annotations: {
 service: 'payment-service',
 environment: 'production'
 }
 },
 {
 id: 'alert-2',
 ruleId: 'rule-2',
 dashboardId: 'dashboard-1',
 widgetId: 'widget-2',
 status: 'firing',
 severity: 'high',
 message: 'Response time exceeded threshold',
 value: 2500,
 threshold: 2000,
 startTime: new Date(Date.now() - 1800000),
 annotations: {
 service: 'user-service',
 environment: 'production'
 }
 },
 {
 id: 'alert-3',
 ruleId: 'rule-3',
 dashboardId: 'dashboard-1',
 widgetId: 'widget-3',
 status: 'resolved',
 severity: 'medium',
 message: 'Memory usage above normal',
 value: 78,
 threshold: 80,
 startTime: new Date(Date.now() - 3600000),
 endTime: new Date(Date.now() - 1800000),
 annotations: {
 service: 'auth-service',
 environment: 'staging'
 }
 }
 ];

 setAlerts(mockAlerts);
 }, []);

 const filteredAlerts = alerts.filter(alert => {
 const matchesStatus = filter === 'all' || alert.status === filter;
 const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
 const matchesSearch = searchTerm === '' || 
 alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
 Object.values(alert.annotations || {}).some(value =>
 value.toLowerCase().includes(searchTerm.toLowerCase())
 );

 return matchesStatus && matchesSeverity && matchesSearch;
 });

 const firingAlertsCount = alerts.filter(a => a.status === 'firing').length;
 const criticalAlertsCount = alerts.filter(a => a.status === 'firing' && a.severity === 'critical').length;

 const handleAcknowledge = (alertId: string) => {
 // In a real app, this would call an API
 // TODO: Send acknowledgment to alert service
 };

 const handleResolve = (alertId: string) => {
 setAlerts(prev => 
 prev.map(alert => 
 alert.id === alertId 
 ? { ...alert, status: 'resolved' as const, endTime: new Date() }
 : alert
 )
 );
 };

 return (
 <div className={cn('flex flex-col h-full', className)}>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-border">
 <div>
 <h2 className="text-xl font-semibold">Alert Management</h2>
 <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
 <span className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-red-500" />
 {firingAlertsCount} firing
 </span>
 <span className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-orange-500" />
 {criticalAlertsCount} critical
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowRules(!showRules)}
 className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 <Settings className="w-4 h-4" />
 Rules
 </button>
 <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
 <Plus className="w-4 h-4" />
 New Rule
 </button>
 </div>
 </div>

 {/* Filters */}
 <div className="flex items-center gap-4 p-4 border-b border-border">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search alerts..."
 className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background"
 />
 </div>

 <select
 value={filter}
 onChange={(e) => setFilter(e.target.value as any)}
 className="px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="all">All Status</option>
 <option value="firing">Firing</option>
 <option value="resolved">Resolved</option>
 </select>

 <select
 value={severityFilter}
 onChange={(e) => setSeverityFilter(e.target.value)}
 className="px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="all">All Severity</option>
 <option value="critical">Critical</option>
 <option value="high">High</option>
 <option value="medium">Medium</option>
 <option value="low">Low</option>
 </select>
 </div>

 {/* Alert List */}
 <div className="flex-1 overflow-auto p-4">
 {filteredAlerts.length > 0 ? (
 <div className="space-y-3">
 {filteredAlerts.map(alert => (
 <AlertItem
 key={alert.id}
 alert={alert}
 onAcknowledge={handleAcknowledge}
 onResolve={handleResolve}
 />
 ))}
 </div>
 ) : (
 <div className="flex items-center justify-center h-full">
 <div className="text-center">
 <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
 <h3 className="font-semibold mb-2">No Alerts</h3>
 <p className="text-sm text-muted-foreground">
 {searchTerm || filter !== 'all' || severityFilter !== 'all'
 ? 'No alerts match your current filters'
 : 'All systems are operating normally'
 }
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};